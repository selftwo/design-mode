import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const baseUrl = process.env.GATE_BASE_URL ?? 'http://127.0.0.1:4173'
const outRoot = path.resolve('.scratch/designmode-pivot/gate-10-evidence')

function svgDataUrl(label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="100%" height="100%" fill="#eef2ff"/><rect x="40" y="40" width="1200" height="640" rx="24" fill="white" stroke="#5b57d9" stroke-width="4"/><text x="50%" y="48%" text-anchor="middle" font-family="system-ui" font-size="42" fill="#171a21">${label}</text></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

const aspectsBoard = {
  schemaVersion: 1,
  boardId: 'gate-aspects',
  camera: { worldX: 0, worldY: 0, zoom: 1 },
  frames: [{
    id: 'frame-aspects',
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
        label: 'Keep plan',
        role: 'button',
        bounds: [[0.42, 0.38], [0.58, 0.52]],
      },
      {
        id: 'summary-pane',
        label: 'Order summary',
        role: 'aside',
        bounds: [[0.62, 0.2], [0.92, 0.85]],
      },
    ],
  }],
  annotations: [],
}

const dispatchBoard = {
  schemaVersion: 1,
  boardId: 'gate-dispatch',
  camera: { worldX: 0, worldY: 0, zoom: 1 },
  frames: [{
    id: 'frame-dispatch',
    label: 'Hero',
    route: '/hero',
    viewport: { width: 1280, height: 720 },
    x: 200,
    y: 100,
    width: 640,
    height: 360,
    aspectRatio: 16 / 9,
    screenshotPath: 'screens/hero.svg',
    screenshotDataUrl: svgDataUrl('Hero'),
    refreshedScreenshotDataUrl: svgDataUrl('Hero refresh'),
    captureHash: 'gate-hero-revision-1',
    revision: 1,
    elements: [],
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
      if (data.type === 'design-review/deliver-review-batch' && data.schemaVersion === 1) {
        window.postMessage({
          type: 'design-review/review-batch-delivered',
          schemaVersion: 1,
          requestId: data.requestId,
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

async function captureBoardAtRest(page, theme, outDir) {
  await setTheme(page, theme)
  await installHost(page, {
    schemaVersion: 1,
    boardId: 'gate-board',
    camera: { worldX: 40, worldY: 20, zoom: 0.65 },
    frames: Array.from({ length: 3 }, (_, index) => ({
      id: `frame-${index + 1}`,
      label: `Screen ${String(index + 1).padStart(2, '0')}`,
      route: `/screen/${index + 1}`,
      viewport: { width: 1280, height: 720 },
      x: 120 + index * 420,
      y: 80 + (index % 2) * 220,
      width: 360,
      height: 202.5,
      aspectRatio: 16 / 9,
      screenshotPath: `screens/frame-${index + 1}.svg`,
      screenshotDataUrl: svgDataUrl(`Screen ${index + 1}`),
      refreshedScreenshotDataUrl: svgDataUrl(`Screen ${index + 1}`),
      captureHash: `gate-frame-${index + 1}`,
      revision: 1,
      elements: [],
    })),
    annotations: [],
  })
  await page.goto(`${baseUrl}/?engine=reactflow`)
  await page.getByTestId('reactflow-canvas').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.react-flow__pane').click({ position: { x: 24, y: 24 } })
  await page.getByTestId('summoned-inspector-island').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {})
  await page.screenshot({ path: path.join(outDir, '01-board.png'), fullPage: false })
}

async function captureAspects(page, theme, outDir) {
  await setTheme(page, theme)
  await installHost(page, aspectsBoard)
  await page.goto(`${baseUrl}/?engine=reactflow`)
  await page.getByTestId('reactflow-canvas').waitFor({ state: 'visible', timeout: 30_000 })
  const surface = await page.getByTestId('surface-frame-aspects').boundingBox()
  if (!surface) throw new Error('aspects frame missing')
  await page.mouse.click(surface.x + surface.width * 0.5, surface.y + surface.height * 0.45)
  await page.getByTestId('summoned-inspector-island').waitFor({ state: 'visible', timeout: 10_000 })
  await page.getByTestId('annotation-aspects-panel').waitFor({ state: 'visible', timeout: 10_000 })
  await page.screenshot({ path: path.join(outDir, '02-aspects.png'), fullPage: false })
}

async function captureReviewDispatch(page, theme, outDir) {
  await setTheme(page, theme)
  await installHost(page, dispatchBoard)
  await page.goto(`${baseUrl}/?engine=reactflow`)
  await page.getByTestId('reactflow-canvas').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByTestId('tool-comment').click()
  const surface = await page.getByTestId('surface-frame-dispatch').boundingBox()
  if (!surface) throw new Error('dispatch frame missing')
  await page.mouse.click(surface.x + surface.width * 0.55, surface.y + surface.height * 0.5)
  await page.getByTestId('instruction-input').waitFor({ state: 'visible', timeout: 10_000 })
  await page.getByTestId('instruction-input').fill('Tighten the hero measure and quiet the subhead')
  await page.getByTestId('intent-distill').click()
  await page.screenshot({ path: path.join(outDir, '03-review-dispatch.png'), fullPage: false })
}

async function captureDeliveredBloom(page, theme, outDir) {
  await setTheme(page, theme)
  await installHost(page, dispatchBoard)
  await page.goto(`${baseUrl}/?engine=reactflow`)
  await page.getByTestId('reactflow-canvas').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByTestId('tool-comment').click()
  const surface = await page.getByTestId('surface-frame-dispatch').boundingBox()
  if (!surface) throw new Error('dispatch frame missing')
  await page.mouse.click(surface.x + surface.width * 0.4, surface.y + surface.height * 0.55)
  await page.getByTestId('instruction-input').fill('Confirm the button label matches the design spec')
  await page.getByTestId('tool-select').click()
  await page.getByTestId('export-annotation').click()
  await page.getByTestId('export-status').waitFor({ state: 'visible', timeout: 10_000 })
  await page.screenshot({ path: path.join(outDir, '04-returned-run.png'), fullPage: false })
}

async function captureStates(browser, theme, outDir) {
  const pickerPage = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await setTheme(pickerPage, theme)
  await pickerPage.route('**/api/projects', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projects: [{
          id: 'demo-app',
          name: 'Demo App',
          path: '/Users/reviewer/code/demo-app',
          devCommand: 'npm run dev',
          devPort: 5173,
          routes: [{ id: 'home', label: 'Home', path: '/' }],
          registeredAt: '2026-07-01T12:00:00.000Z',
        }],
      }),
    })
  })
  await pickerPage.addInitScript(() => {
    window.__designModeHost = { version: 1 }
  })
  await pickerPage.goto(`${baseUrl}/`)
  await pickerPage.getByTestId('project-picker').waitFor({ state: 'visible', timeout: 30_000 })
  await pickerPage.screenshot({ path: path.join(outDir, '05-states-picker.png'), fullPage: false })
  await pickerPage.close()

  const boardPage = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await setTheme(boardPage, theme)
  await installHost(boardPage, dispatchBoard)
  await boardPage.goto(`${baseUrl}/?engine=reactflow`)
  await boardPage.getByTestId('reactflow-canvas').waitFor({ state: 'visible', timeout: 30_000 })
  await boardPage.getByTestId('tool-comment').click()
  const surface = await boardPage.getByTestId('surface-frame-dispatch').boundingBox()
  if (!surface) throw new Error('dispatch frame missing')
  await boardPage.mouse.click(surface.x + surface.width * 0.3, surface.y + surface.height * 0.4)
  await boardPage.getByTestId('instruction-input').fill('Dirty note for reset dialog')
  await boardPage.getByTestId('reset-board').click()
  await boardPage.getByRole('dialog', { name: 'Reset board?' }).waitFor({ state: 'visible', timeout: 10_000 })
  await boardPage.screenshot({ path: path.join(outDir, '05-states-reset-dialog.png'), fullPage: false })
  await boardPage.close()
}

mkdirSync(outRoot, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })

try {
  for (const theme of ['light', 'dark']) {
    const outDir = path.join(outRoot, theme)
    mkdirSync(outDir, { recursive: true })
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    await captureBoardAtRest(page, theme, outDir)
    await captureAspects(page, theme, outDir)
    await captureReviewDispatch(page, theme, outDir)
    await captureDeliveredBloom(page, theme, outDir)
    await captureStates(browser, theme, outDir)
    await page.close()
    writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
      theme,
      baseUrl,
      viewport: { width: 1280, height: 720 },
      surfaces: ['board', 'aspects', 'review-dispatch', 'returned-run', 'states-picker', 'states-reset-dialog'],
      capturedAt: new Date().toISOString(),
    }, null, 2))
    process.stdout.write(`Captured phase-2 gate surfaces (${theme}) to ${outDir}\n`)
  }
} finally {
  await browser.close()
}
