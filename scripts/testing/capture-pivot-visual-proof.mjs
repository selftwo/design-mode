#!/usr/bin/env node
/**
 * Capture post-pivot flow stills + GIF frame sequences for the visual proof artifact.
 * Expects GATE_BASE_URL (vite preview) and optionally LIVE_FIXTURE at :5199.
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync, cpSync, existsSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const baseUrl = process.env.GATE_BASE_URL ?? 'http://127.0.0.1:4173'
const outRoot = path.resolve('.scratch/designmode-pivot/visual-proof')
const afterDir = path.join(outRoot, 'after')
const gifDir = path.join(outRoot, 'gifs')
const framesDir = path.join(outRoot, 'gif-frames')

function svgDataUrl(label, w = 1280, h = 720) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#eef2ff"/><rect x="40" y="40" width="${w - 80}" height="${h - 80}" rx="24" fill="white" stroke="#5b57d9" stroke-width="4"/><text x="50%" y="48%" text-anchor="middle" font-family="system-ui" font-size="42" fill="#171a21">${label}</text></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function boardWithElements() {
  return {
    schemaVersion: 1,
    boardId: 'visual-proof',
    camera: { worldX: 40, worldY: 20, zoom: 0.75 },
    frames: [{
      id: 'frame-01',
      label: 'Pricing',
      route: '/pricing',
      viewport: { width: 1280, height: 720 },
      x: 200,
      y: 100,
      width: 720,
      height: 405,
      aspectRatio: 16 / 9,
      screenshotPath: 'screens/pricing.svg',
      screenshotDataUrl: svgDataUrl('Pricing'),
      refreshedScreenshotDataUrl: svgDataUrl('Pricing v2'),
      captureHash: 'pricing-r1',
      revision: 1,
      elements: [
        { id: 'hero', label: 'Hero', role: 'banner', bounds: [[0.1, 0.1], [0.9, 0.35]] },
        { id: 'cta', label: 'Keep plan', role: 'button', bounds: [[0.4, 0.4], [0.6, 0.55]] },
      ],
    }],
    annotations: [],
  }
}

async function installHost(page, board, extra = {}) {
  await page.addInitScript(({ serializedBoard, teachAnswer }) => {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'design-review/request-board') {
        window.postMessage({ type: 'design-review/load-board', schemaVersion: 1, board: serializedBoard }, window.location.origin)
      }
      if (data.type === 'design-review/request-live-session' && data.schemaVersion === 1) {
        const focusToken = crypto.randomUUID()
        const hash = new URLSearchParams({ frameId: data.frameId, token: focusToken }).toString()
        window.postMessage({
          type: 'design-review/live-session',
          schemaVersion: 1,
          requestId: data.requestId,
          frameId: data.frameId,
          liveUrl: `http://127.0.0.1:5199/live-review.html#${hash}`,
          allowedOrigin: 'http://127.0.0.1:5199',
          focusToken,
        }, window.location.origin)
      }
      if (data.type === 'design-review/deliver-review-batch' && data.schemaVersion === 1) {
        window.postMessage({
          type: 'design-review/review-batch-delivered',
          schemaVersion: 1,
          requestId: data.requestId,
        }, window.location.origin)
      }
      if (data.type === 'design-review/ask-teach-question' && data.schemaVersion === 1) {
        window.postMessage({
          type: 'design-review/teach-answer',
          schemaVersion: 1,
          requestId: data.requestId,
          answer: {
            answer: teachAnswer ?? 'Measure is the length of a text line. Cap it near 60–70 characters.',
            runId: 'run-teach-proof',
          },
        }, window.location.origin)
      }
    })
  }, { serializedBoard: board, teachAnswer: extra.teachAnswer })
}

async function setTheme(page, theme) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('design-review-theme', value)
    document.documentElement.setAttribute('data-theme', value)
  }, theme)
}

async function framePoint(page, frameId, normalized) {
  const rect = await page.getByTestId(`surface-${frameId}`).boundingBox()
  if (!rect) throw new Error(`No surface for ${frameId}`)
  return { x: rect.x + rect.width * normalized[0], y: rect.y + rect.height * normalized[1] }
}

async function shot(page, file) {
  const dest = path.join(afterDir, file)
  mkdirSync(path.dirname(dest), { recursive: true })
  await page.screenshot({ path: dest, fullPage: false })
  return dest
}

async function gifFrames(page, name, captureSteps) {
  const dir = path.join(framesDir, name)
  mkdirSync(dir, { recursive: true })
  let i = 0
  for (const step of captureSteps) {
    await step()
    await page.waitForTimeout(120)
    const file = path.join(dir, `frame-${String(i).padStart(2, '0')}.png`)
    await page.screenshot({ path: file, fullPage: false })
    i += 1
  }
  return dir
}

function encodeGif(frameDir, outName) {
  mkdirSync(gifDir, { recursive: true })
  const out = path.join(gifDir, outName)
  const frames = readdirSync(frameDir).filter((f) => f.endsWith('.png')).sort()
  if (frames.length === 0) return null
  const result = spawnSync('ffmpeg', [
    '-y',
    '-framerate', '1.5',
    '-i', path.join(frameDir, 'frame-%02d.png'),
    '-vf', 'scale=960:-1:flags=lanczos',
    '-loop', '0',
    out,
  ], { encoding: 'utf8' })
  if (result.status !== 0) {
    console.error(result.stderr)
    throw new Error(`ffmpeg failed for ${outName}`)
  }
  return out
}

async function gotoBoard(page, board) {
  await installHost(page, board)
  await page.goto(`${baseUrl}/?engine=reactflow`)
  await page.getByTestId('board-status').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByTestId('reactflow-canvas').waitFor({ state: 'visible' })
}

async function main() {
  mkdirSync(afterDir, { recursive: true })
  mkdirSync(gifDir, { recursive: true })
  mkdirSync(framesDir, { recursive: true })

  // Copy phase-1 before/after stills into the proof tree for side-by-side.
  const gate04 = path.resolve('.scratch/designmode-pivot/gate-04-evidence')
  if (existsSync(gate04)) {
    cpSync(path.join(gate04, 'before'), path.join(outRoot, 'before-phase1'), { recursive: true })
    cpSync(path.join(gate04, 'after'), path.join(outRoot, 'after-phase1-reskin'), { recursive: true })
  }
  for (const [src, dest] of [
    ['gate-10-evidence/light', 'phase2-light'],
    ['gate-13-evidence/light', 'phase3-light'],
    ['gate-13-evidence/dark', 'phase3-dark'],
    ['gate-15-evidence/light', 'phase4-mweb-light'],
    ['gate-15-evidence/dark', 'phase4-mweb-dark'],
  ]) {
    const from = path.resolve('.scratch/designmode-pivot', src)
    if (existsSync(from)) cpSync(from, path.join(outRoot, dest), { recursive: true })
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })

  // ── Board at rest (floating chrome) ──────────────────────────
  await setTheme(page, 'light')
  await gotoBoard(page, boardWithElements())
  await page.waitForTimeout(400)
  await shot(page, '01-board-at-rest.png')

  // ── Theme toggle GIF ─────────────────────────────────────────
  {
    const dir = await gifFrames(page, 'theme-toggle', [
      async () => {},
      async () => { await page.getByTestId('theme-toggle').click() },
      async () => { await page.waitForTimeout(200) },
      async () => { await page.getByTestId('theme-toggle').click() },
      async () => { await page.waitForTimeout(200) },
    ])
    encodeGif(dir, 'theme-toggle.gif')
    await page.getByTestId('theme-toggle').click()
    await page.waitForTimeout(200)
    await shot(page, '02-theme-dark.png')
    await page.getByTestId('theme-toggle').click()
    await page.waitForTimeout(200)
  }

  // Fresh light board for structural stills (avoid theme / bloom bleed).
  await page.close()
  const structural = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await setTheme(structural, 'light')
  await gotoBoard(structural, boardWithElements())
  await structural.waitForTimeout(300)

  // ── Layers + aspects island ──────────────────────────────────
  await structural.getByTestId('surface-frame-01').click({ position: { x: 40, y: 40 } })
  await structural.waitForTimeout(300)
  await shot(structural, '03-layers-aspects-island.png')

  // ── Bloom thread flow GIF ────────────────────────────────────
  await structural.keyboard.press('Escape').catch(() => {})
  await structural.locator('body').click({ position: { x: 10, y: 10 }, force: true }).catch(() => {})
  await structural.waitForTimeout(200)
  {
    const dir = await gifFrames(structural, 'bloom-thread', [
      async () => {
        await structural.getByTestId('tool-circle').click()
      },
      async () => {
        const a = await framePoint(structural, 'frame-01', [0.45, 0.45])
        const b = await framePoint(structural, 'frame-01', [0.7, 0.7])
        await structural.mouse.move(a.x, a.y)
        await structural.mouse.down()
        await structural.mouse.move(b.x, b.y, { steps: 6 })
        await structural.mouse.up()
      },
      async () => {
        await structural.getByTestId('instruction-input').waitFor({ state: 'visible', timeout: 10_000 })
        await structural.getByTestId('instruction-input').fill('Tighten the hero measure')
      },
      async () => {
        await structural.getByTestId('intent-distill').click()
      },
      async () => {
        await structural.waitForTimeout(200)
      },
    ])
    encodeGif(dir, 'bloom-thread.gif')
    await shot(structural, '04-bloom-open.png')
  }

  // ── Comments jump-list ───────────────────────────────────────
  const jumpToggle = structural.getByTestId('toggle-comments-panel')
  if (await jumpToggle.count()) {
    await jumpToggle.focus()
    await structural.keyboard.press('Enter')
    await structural.waitForTimeout(250)
  }
  await shot(structural, '05-comments-jump-list.png')
  await structural.close()

  // ── Learn lens (fresh light page — no leftover blooms) ───────
  {
    const learnPage = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    await setTheme(learnPage, 'light')
    await gotoBoard(learnPage, boardWithElements())
    await learnPage.getByTestId('tool-learn').click()
    await learnPage.waitForTimeout(200)
    const hero = await framePoint(learnPage, 'frame-01', [0.5, 0.22])
    await learnPage.mouse.click(hero.x, hero.y)
    await learnPage.getByTestId('learn-lens-anatomy').waitFor({ state: 'visible', timeout: 10_000 })
    await shot(learnPage, '06-learn-lens.png')

    const dir = await gifFrames(learnPage, 'learn-lens', [
      async () => {},
      async () => {
        const point = await framePoint(learnPage, 'frame-01', [0.5, 0.48])
        await learnPage.mouse.click(point.x, point.y)
      },
      async () => { await learnPage.waitForTimeout(250) },
    ])
    encodeGif(dir, 'learn-lens.gif')

    const askInput = learnPage.getByTestId('learn-question-input')
    if (await askInput.count()) {
      await askInput.fill('What is measure?')
      const askBtn = learnPage.getByTestId('learn-question-submit')
      if (await askBtn.count() && await askBtn.isEnabled()) {
        await askBtn.click()
        await learnPage.getByTestId('learn-answer-block').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
        await learnPage.waitForTimeout(300)
        const pin = learnPage.getByTestId('learn-pin-answer')
        if (await pin.count()) {
          await pin.click()
          await learnPage.waitForTimeout(350)
          await shot(learnPage, '07-teach-pinned.png')
        }
      }
    }
    await learnPage.close()
  }

  // ── Island dodge GIF (fresh light page) ──────────────────────
  {
    const dodgePage = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    await setTheme(dodgePage, 'light')
    await gotoBoard(dodgePage, boardWithElements())
    const dir = await gifFrames(dodgePage, 'island-dodge', [
      async () => {},
      async () => {
        const point = await framePoint(dodgePage, 'frame-01', [0.75, 0.55])
        await dodgePage.mouse.click(point.x, point.y)
      },
      async () => { await dodgePage.waitForTimeout(300) },
      async () => {
        const point = await framePoint(dodgePage, 'frame-01', [0.15, 0.2])
        await dodgePage.mouse.click(point.x, point.y)
      },
      async () => { await dodgePage.waitForTimeout(300) },
    ])
    encodeGif(dir, 'island-dodge.gif')
    await dodgePage.close()
  }

  // Gate-15 m-web stills are the authoritative companion proof; skip a sparse live boards shot.

  const manifest = {
    capturedAt: new Date().toISOString(),
    baseUrl,
    afterStills: readdirSync(afterDir).filter((f) => f.endsWith('.png')),
    gifs: existsSync(gifDir) ? readdirSync(gifDir).filter((f) => f.endsWith('.gif')) : [],
  }
  writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify(manifest, null, 2))
  await browser.close()
  console.log(JSON.stringify(manifest, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
