import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const baseUrl = process.env.GATE_BASE_URL ?? 'http://127.0.0.1:4173'
const outRoot = path.resolve('.scratch/designmode-pivot/gate-15-evidence')
const viewport = { width: 390, height: 844 }

const approveBoard = {
  schemaVersion: 1,
  boardId: 'smalltools — landing review',
  camera: { worldX: 0, worldY: 0, zoom: 1 },
  frames: [{
    id: 'frame-home',
    label: 'Home',
    route: '/',
    viewport: { width: 1440, height: 900 },
    x: 0,
    y: 0,
    width: 390,
    height: 844,
    aspectRatio: 390 / 844,
    screenshotPath: 'screens/home.svg',
    screenshotDataUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzOTAiIGhlaWdodD0iODQ0IiB2aWV3Qm94PSIwIDAgMzkwIDg0NCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2ZiZmFmOCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic3lzdGVtLXVpIiBmb250LXNpemU9IjI0IiBmaWxsPSIjMzUzMjJjIj5Ib21lPC90ZXh0Pjwvc3ZnPg==',
    refreshedScreenshotDataUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzOTAiIGhlaWdodD0iODQ0IiB2aWV3Qm94PSIwIDAgMzkwIDg0NCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2ZiZmFmOCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic3lzdGVtLXVpIiBmb250LXNpemU9IjI0IiBmaWxsPSIjMzUzMjJjIj5Ib21lPC90ZXh0Pjwvc3ZnPg==',
    captureHash: 'home-revision-1',
    revision: 1,
    elements: [],
  }],
  annotations: [{
    kind: 'review',
    id: 'annotation-hero',
    frameId: 'frame-home',
    status: 'draft',
    instruction: 'Hero measure runs the full row. Cap it and let the cards carry the width.',
    intent: 'distill',
    anchor: [0.55, 0.22],
    mark: { kind: 'circle', points: [[0.45, 0.15], [0.65, 0.3]] },
    replies: [],
    createdAt: '2026-07-17T11:58:00.000Z',
    madeAgainstCaptureHash: 'home-revision-1',
    madeAgainstRevision: 1,
  }, {
    kind: 'teach',
    id: 'teach-hero',
    frameId: 'frame-home',
    status: 'draft',
    instruction: 'Measure is the length of a text line. Long measures tire the eye.',
    question: 'What is measure?',
    provenanceRunId: 'run-teach-141',
    anchor: [0.5, 0.3],
    mark: {
      kind: 'element',
      elementId: 'hero',
      label: 'hero',
      points: [[0.2, 0.15], [0.8, 0.45]],
    },
    createdAt: '2026-07-17T11:55:00.000Z',
    madeAgainstCaptureHash: 'home-revision-1',
    madeAgainstRevision: 1,
  }],
}

const approveRun = {
  id: 'run-approve-142',
  projectId: 'smalltools',
  agent: 'codex',
  status: 'done',
  annotationIds: ['annotation-hero'],
  outputTail: 'Proposed: measure capped at 60ch, cards move up 32px. Patch staged.',
  startedAt: '2026-07-17T11:59:00.000Z',
  finishedAt: '2026-07-17T12:00:00.000Z',
}

async function installMWebHost(page, board, runs = [approveRun]) {
  let currentBoard = structuredClone(board)
  await page.addInitScript(() => {
    window.__designModeHost = { version: 1 }
  })
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const { pathname } = url
    if (pathname === '/api/projects' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projects: [{
            id: 'smalltools',
            name: 'smalltools',
            path: '/tmp/smalltools',
            devCommand: 'npm run dev',
            devPort: 5173,
            routes: [{ id: 'home', label: 'Home', path: '/' }],
            registeredAt: '2026-07-17T00:00:00.000Z',
          }],
        }),
      })
      return
    }
    if (pathname === '/api/projects/smalltools/board' && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ board: currentBoard }) })
      return
    }
    if (pathname === '/api/projects/smalltools/board' && request.method() === 'PUT') {
      currentBoard = JSON.parse(request.postData() ?? '{}')
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ saved: true }) })
      return
    }
    if (pathname === '/api/runs' && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ runs }) })
      return
    }
    if (pathname === '/api/events' && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': connected\n\n' })
      return
    }
    await route.fulfill({ status: 404, body: JSON.stringify({ error: `Unhandled ${request.method()} ${pathname}` }) })
  })
}

async function setTheme(page, theme) {
  await page.addInitScript((value) => {
    localStorage.setItem('design-review-theme', value)
    document.documentElement.setAttribute('data-theme', value)
  }, theme)
}

async function captureSurfaces(page, theme, outDir) {
  await setTheme(page, theme)
  await installMWebHost(page, approveBoard)

  await page.goto(`${baseUrl}/m-web.html#/boards`)
  await page.getByTestId('mweb-boards-page').waitFor({ state: 'visible', timeout: 15_000 })
  await page.screenshot({ path: path.join(outDir, '01-boards.png'), fullPage: true })

  await page.getByTestId('mweb-board-smalltools').click()
  await page.getByTestId('mweb-capture-page').waitFor({ state: 'visible' })
  await page.screenshot({ path: path.join(outDir, '02-capture.png'), fullPage: true })

  await page.getByLabel('Annotation 1 on Home').click()
  await page.getByTestId('mweb-thread-sheet').waitFor({ state: 'visible' })
  await page.screenshot({ path: path.join(outDir, '03-thread-open.png'), fullPage: true })

  await page.getByTestId('mweb-approve-submit').click()
  await page.getByTestId('thread-annotation-hero').waitFor({ state: 'visible' })
  await page.screenshot({ path: path.join(outDir, '04-thread-approved.png'), fullPage: true })

  await page.goto(`${baseUrl}/m-web.html#/projects/smalltools/runs`)
  await page.getByTestId('mweb-runs-page').waitFor({ state: 'visible' })
  await page.screenshot({ path: path.join(outDir, '05-runs.png'), fullPage: true })

  await page.goto(`${baseUrl}/m-web.html#/notices`)
  await page.getByTestId('mweb-notices-page').waitFor({ state: 'visible' })
  await page.screenshot({ path: path.join(outDir, '06-notices.png'), fullPage: true })

  await page.goto(`${baseUrl}/m-web.html#/boards`)
  await page.getByTestId('mweb-theme-toggle').waitFor({ state: 'visible' })
  await page.getByTestId('mweb-theme-toggle').screenshot({ path: path.join(outDir, '07-theme-toggle.png') })
}

mkdirSync(outRoot, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })

try {
  for (const theme of ['light', 'dark']) {
    const outDir = path.join(outRoot, theme)
    mkdirSync(outDir, { recursive: true })
    const page = await browser.newPage({ viewport })
    await captureSurfaces(page, theme, outDir)
    await page.close()
    writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
      theme,
      baseUrl,
      viewport,
      surfaces: ['boards', 'capture', 'thread-open', 'thread-approved', 'runs', 'notices', 'theme-toggle'],
      capturedAt: new Date().toISOString(),
    }, null, 2))
    process.stdout.write(`Captured phase-4 gate surfaces (${theme}) to ${outDir}\n`)
  }

  writeFileSync(path.join(outRoot, 'verdict.json'), JSON.stringify({
    phase: 4,
    gateTicket: 15,
    verify: 'pending-full-verify',
    capturedAt: new Date().toISOString(),
    viewport,
    themes: ['light', 'dark'],
  }, null, 2))
} finally {
  await browser.close()
}
