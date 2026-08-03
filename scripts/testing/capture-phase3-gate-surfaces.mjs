import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const baseUrl = process.env.GATE_BASE_URL ?? 'http://127.0.0.1:4173'
const outRoot = path.resolve('.scratch/designmode-pivot/gate-13-evidence')

function svgDataUrl(label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="100%" height="100%" fill="#eef2ff"/><rect x="40" y="40" width="1200" height="640" rx="24" fill="white" stroke="#5b57d9" stroke-width="4"/><text x="50%" y="48%" text-anchor="middle" font-family="system-ui" font-size="42" fill="#171a21">${label}</text></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

const learnBoard = {
  schemaVersion: 1,
  boardId: 'gate-learn-lens',
  camera: { worldX: 0, worldY: -40, zoom: 1 },
  frames: [{
    id: 'frame-learn',
    label: 'Pricing',
    route: '/pricing',
    viewport: { width: 1280, height: 720 },
    x: 280,
    y: 120,
    width: 720,
    height: 405,
    aspectRatio: 16 / 9,
    screenshotPath: 'screens/pricing.svg',
    screenshotDataUrl: svgDataUrl('Pricing'),
    refreshedScreenshotDataUrl: svgDataUrl('Pricing refresh'),
    captureHash: 'gate-pricing-revision-1',
    revision: 1,
    elements: [
      {
        id: 'plan-keep',
        label: 'plan-keep',
        role: 'group',
        bounds: [[0.58, 0.18], [0.94, 0.88]],
        aspects: {
          layout: { x: 232, y: 54, width: 144, height: 210, rotation: 0 },
          flex: { direction: 'column', gap: '8px', padding: '12px 12px', align: 'start' },
          radius: '6px',
          fills: [{ name: 'card-bg', value: '#ffffff' }],
          border: { width: '1px', color: { name: 'hairline', value: '#e6e6e6' } },
        },
      },
    ],
  }],
  annotations: [],
}

async function installHost(page, board) {
  await page.addInitScript(({ serializedBoard }) => {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'design-review/request-board') {
        window.postMessage({ type: 'design-review/load-board', schemaVersion: 1, board: serializedBoard }, window.location.origin)
      }
      if (data.type === 'design-review/ask-teach-question' && data.schemaVersion === 1) {
        window.postMessage({
          type: 'design-review/teach-answer',
          schemaVersion: 1,
          requestId: data.requestId,
          answer: {
            answer: 'The filled button is the only solid-ink block in either card, so Keep carries more visual weight.',
            runId: 'teach-run-gate',
          },
        }, window.location.origin)
      }
    })
  }, { serializedBoard: board })
}

async function setTheme(page, theme) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('design-review-theme', value)
    document.documentElement.setAttribute('data-theme', value)
  }, theme)
}

async function elementPoint(page, testId, normalized) {
  const rect = await page.getByTestId(testId).boundingBox()
  if (!rect) throw new Error(`Surface ${testId} missing`)
  return { x: rect.x + rect.width * normalized[0], y: rect.y + rect.height * normalized[1] }
}

async function captureLearnLensOpen(page, theme, outDir) {
  await setTheme(page, theme)
  await installHost(page, learnBoard)
  await page.goto(`${baseUrl}/?engine=reactflow`)
  await page.getByTestId('reactflow-canvas').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByTestId('tool-learn').click()
  await page.getByTestId('learn-lens-island').waitFor({ state: 'visible', timeout: 10_000 })
  const point = await elementPoint(page, 'surface-frame-learn', [0.76, 0.45])
  await page.mouse.click(point.x, point.y)
  await page.getByTestId('learn-lens-term').waitFor({ state: 'visible', timeout: 10_000 })
  await page.screenshot({ path: path.join(outDir, '01-learn-lens-open.png'), fullPage: false })
}

async function captureLearnLensAnswered(page, theme, outDir) {
  await setTheme(page, theme)
  await installHost(page, learnBoard)
  await page.goto(`${baseUrl}/?engine=reactflow`)
  await page.getByTestId('reactflow-canvas').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByTestId('tool-learn').click()
  const point = await elementPoint(page, 'surface-frame-learn', [0.76, 0.45])
  await page.mouse.click(point.x, point.y)
  await page.getByTestId('learn-question-input').fill('Why does this card read heavier than the others?')
  await page.getByTestId('learn-question-submit').click()
  await page.getByTestId('learn-answer-text').waitFor({ state: 'visible', timeout: 10_000 })
  await page.screenshot({ path: path.join(outDir, '02-learn-lens-answered.png'), fullPage: false })
}

async function captureTeachPinned(page, theme, outDir) {
  await setTheme(page, theme)
  await installHost(page, learnBoard)
  await page.goto(`${baseUrl}/?engine=reactflow`)
  await page.getByTestId('reactflow-canvas').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByTestId('tool-learn').click()
  const point = await elementPoint(page, 'surface-frame-learn', [0.76, 0.45])
  await page.mouse.click(point.x, point.y)
  await page.getByTestId('learn-question-input').fill('Why does this card read heavier than the others?')
  await page.getByTestId('learn-question-submit').click()
  await page.getByTestId('learn-answer-text').waitFor({ state: 'visible', timeout: 10_000 })
  await page.getByTestId('learn-pin-answer').click()
  await page.locator('[data-testid^="teach-note-"]').first().waitFor({ state: 'visible', timeout: 10_000 })
  await page.screenshot({ path: path.join(outDir, '03-teach-pinned.png'), fullPage: false })
}

async function captureThemeToggle(page, theme, outDir) {
  await setTheme(page, theme)
  await installHost(page, learnBoard)
  await page.goto(`${baseUrl}/?engine=reactflow`)
  await page.getByTestId('reactflow-canvas').waitFor({ state: 'visible', timeout: 30_000 })
  const toggle = page.getByTestId('theme-toggle')
  await toggle.waitFor({ state: 'visible', timeout: 10_000 })
  await toggle.screenshot({ path: path.join(outDir, '04-theme-toggle.png') })
}

mkdirSync(outRoot, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })

try {
  for (const theme of ['light', 'dark']) {
    const outDir = path.join(outRoot, theme)
    mkdirSync(outDir, { recursive: true })
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    await captureLearnLensOpen(page, theme, outDir)
    await captureLearnLensAnswered(page, theme, outDir)
    await captureTeachPinned(page, theme, outDir)
    await captureThemeToggle(page, theme, outDir)
    await page.close()
    writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
      theme,
      baseUrl,
      viewport: { width: 1280, height: 720 },
      surfaces: ['learn-lens-open', 'learn-lens-answered', 'teach-pinned', 'theme-toggle'],
      capturedAt: new Date().toISOString(),
    }, null, 2))
    process.stdout.write(`Captured phase-3 gate surfaces (${theme}) to ${outDir}\n`)
  }
} finally {
  await browser.close()
}
