import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const baseUrl = process.env.GATE_BASE_URL ?? 'http://127.0.0.1:4173'
const label = process.env.GATE_LABEL ?? 'after'
const outDir = path.resolve('.scratch/designmode-pivot/gate-04-evidence', label)

function svgDataUrl(label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="100%" height="100%" fill="#eef2ff"/><rect x="40" y="40" width="1200" height="640" rx="24" fill="white" stroke="#5b57d9" stroke-width="4"/><text x="50%" y="48%" text-anchor="middle" font-family="system-ui" font-size="42" fill="#171a21">${label}</text></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

const boardDocument = {
  schemaVersion: 1,
  boardId: 'gate-phase1',
  camera: { worldX: 0, worldY: 0, zoom: 1 },
  frames: [{
    id: 'frame-01',
    label: 'Screen 01',
    route: '/fixture/1',
    viewport: { width: 1280, height: 720 },
    x: 120,
    y: 80,
    width: 720,
    height: 405,
    aspectRatio: 16 / 9,
    screenshotPath: 'screens/frame-01.svg',
    screenshotDataUrl: svgDataUrl('Gate fixture'),
    refreshedScreenshotDataUrl: svgDataUrl('Gate fixture refresh'),
    captureHash: 'gate-frame-01-revision-1',
    revision: 1,
    elements: [],
  }],
  annotations: [],
}

mkdirSync(outDir, { recursive: true })

async function installHost(page, board) {
  await page.addInitScript(({ serializedBoard }) => {
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
    })
  }, { serializedBoard: board })
}

async function capturePicker(page) {
  await page.route('**/api/projects', async (route) => {
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
          routes: [{ id: 'home', label: 'Home', path: '/' }, { id: 'settings', label: 'Settings', path: '/settings' }],
          registeredAt: '2026-07-01T12:00:00.000Z',
        }],
      }),
    })
  })
  await page.addInitScript(() => {
    window.__designModeHost = { version: 1 }
  })
  await page.goto(`${baseUrl}/`)
  await page.getByTestId('project-picker').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByTestId('picker-project-demo-app').waitFor({ state: 'visible', timeout: 10_000 })
  await page.screenshot({ path: path.join(outDir, '01-picker.png'), fullPage: false })
}

async function captureBoard(page, board) {
  await installHost(page, board)
  await page.goto(`${baseUrl}/?engine=reactflow`)
  await page.getByTestId('reactflow-canvas').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByTestId('surface-frame-01').click({ position: { x: 14, y: 14 } })
  await page.screenshot({ path: path.join(outDir, '02-board.png'), fullPage: false })
}

async function captureAnnotationEditing(page, board) {
  await installHost(page, board)
  await page.goto(`${baseUrl}/?engine=reactflow`)
  await page.getByTestId('reactflow-canvas').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByTestId('tool-comment').click()
  const surface = await page.getByTestId('surface-frame-01').boundingBox()
  if (!surface) throw new Error('frame-01 surface missing')
  const point = { x: surface.x + surface.width * 0.35, y: surface.y + surface.height * 0.45 }
  await page.mouse.click(point.x, point.y)
  await page.getByTestId('instruction-input').waitFor({ state: 'visible', timeout: 10_000 })
  await page.getByTestId('instruction-input').fill('Check header spacing against the spec')
  await page.screenshot({ path: path.join(outDir, '03-annotation-editing.png'), fullPage: false })
}

async function captureLiveView(page, board) {
  await installHost(page, board)
  await page.goto(`${baseUrl}/?engine=reactflow`)
  await page.getByTestId('reactflow-canvas').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByTestId('surface-frame-01').click({ position: { x: 14, y: 14 } })
  await page.getByTestId('focus-selected').click()
  await page.getByTestId('focus-state').waitFor({ state: 'visible', timeout: 15_000 })
  await page.getByTestId('live-state-frame-01').waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(outDir, '04-live-view.png'), fullPage: false })
}

async function captureDispatch(page, board) {
  await installHost(page, board)
  await page.goto(`${baseUrl}/?engine=reactflow`)
  await page.getByTestId('reactflow-canvas').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByTestId('tool-comment').click()
  const surface = await page.getByTestId('surface-frame-01').boundingBox()
  if (!surface) throw new Error('frame-01 surface missing')
  await page.mouse.click(surface.x + surface.width * 0.3, surface.y + surface.height * 0.55)
  await page.getByTestId('instruction-input').fill('Confirm the button label matches the design spec')
  await page.getByTestId('tool-select').click()
  await page.getByTestId('export-annotation').click()
  await page.getByTestId('export-status').waitFor({ state: 'visible', timeout: 10_000 })
  await page.screenshot({ path: path.join(outDir, '05-dispatch.png'), fullPage: false })
}

const browser = await chromium.launch({ channel: 'chrome' })
const pickerPage = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const boardPage = await browser.newPage({ viewport: { width: 1280, height: 720 } })

try {
  await capturePicker(pickerPage)
  await captureBoard(boardPage, boardDocument)
  await captureAnnotationEditing(boardPage, boardDocument)
  await captureLiveView(boardPage, boardDocument)
  await captureDispatch(boardPage, boardDocument)
  writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
    label,
    baseUrl,
    viewport: { width: 1280, height: 720 },
    surfaces: ['picker', 'board', 'annotation-editing', 'live-view', 'dispatch'],
    capturedAt: new Date().toISOString(),
  }, null, 2))
  process.stdout.write(`Captured phase-1 gate surfaces to ${outDir}\n`)
} finally {
  await browser.close()
}
