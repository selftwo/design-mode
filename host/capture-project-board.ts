import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chromium } from '@playwright/test'
import { ScreenFrameSchema, type BoardDocument, type ScreenFrame } from '../src/features/review-board/model/board-document.schema.ts'
import type { Project, ProjectRoute } from '../src/features/local-host/host-api.schema.ts'
import { collectFrameElementsInPage } from './extract-frame-elements.ts'
import { mergeCapturedFrames } from './merge-captured-frames.ts'
import { spawnEnvironment } from './spawn-environment.ts'

const CAPTURE_VIEWPORT = { width: 1440, height: 900 }
const DISPLAY_WIDTH = 420
const DEV_SERVER_TIMEOUT_MS = 60_000

async function devServerResponds(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_500) })
    return response.status < 500
  } catch {
    return false
  }
}

// Dev servers bind IPv4 or IPv6 depending on the tool and OS (Vite 7 binds
// ::1 only on some machines), so find the address that actually answers.
async function respondingDevUrl(project: Project): Promise<string | null> {
  for (const hostname of ['127.0.0.1', 'localhost', '[::1]']) {
    const url = `http://${hostname}:${project.devPort}`
    if (await devServerResponds(url)) return url
  }
  return null
}

export interface DevServerHandle {
  url: string
  startedByHost: boolean
  stop: () => void
}

// Reuses a dev server the user already has running; otherwise starts the
// project's own dev command and owns its lifetime.
export async function ensureDevServer(project: Project): Promise<DevServerHandle> {
  const runningUrl = await respondingDevUrl(project)
  if (runningUrl) {
    return { url: runningUrl, startedByHost: false, stop: () => {} }
  }

  const child: ChildProcess = spawn(project.devCommand, {
    cwd: project.path,
    shell: true,
    stdio: 'ignore',
    detached: true,
    env: spawnEnvironment(),
  })
  const stop = () => {
    if (child.pid && child.exitCode === null) {
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {
        child.kill('SIGTERM')
      }
    }
  }

  const deadline = Date.now() + DEV_SERVER_TIMEOUT_MS
  while (Date.now() < deadline) {
    const startedUrl = await respondingDevUrl(project)
    if (startedUrl) return { url: startedUrl, startedByHost: true, stop }
    if (child.exitCode !== null) break
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  stop()
  throw new Error(`Dev server for ${project.name} did not answer on port ${project.devPort} (command: ${project.devCommand})`)
}

async function captureRoute(
  page: import('@playwright/test').Page,
  baseUrl: string,
  route: ProjectRoute,
): Promise<ScreenFrame> {
  await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'load' })
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
  if (route.click) {
    await page.getByRole('button', { name: route.click, exact: true }).click()
    await page.waitForTimeout(400)
  }
  const elements = await page.evaluate(collectFrameElementsInPage, route.id)
  const screenshot = await page.screenshot({ fullPage: false })
  const aspectRatio = CAPTURE_VIEWPORT.width / CAPTURE_VIEWPORT.height
  const dataUrl = `data:image/png;base64,${screenshot.toString('base64')}`
  return ScreenFrameSchema.parse({
    id: route.id,
    label: route.label,
    route: route.path,
    viewport: CAPTURE_VIEWPORT,
    x: 0,
    y: 0,
    width: DISPLAY_WIDTH,
    height: DISPLAY_WIDTH / aspectRatio,
    aspectRatio,
    screenshotPath: `screens/${route.id}.png`,
    screenshotDataUrl: dataUrl,
    refreshedScreenshotDataUrl: dataUrl,
    captureHash: createHash('sha1').update(screenshot).digest('hex'),
    revision: 1,
    elements,
    kind: 'captured-route',
    lifeState: 'active',
  })
}

// The caller owns the dev server (see the dev server pool in the host), so a
// capture never tears down a server a live session still depends on.
export async function captureProjectBoard(
  project: Project,
  baseUrl: string,
  existingBoard: BoardDocument | null,
  routes: ProjectRoute[] = project.routes,
): Promise<BoardDocument> {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: CAPTURE_VIEWPORT })
    const frames: ScreenFrame[] = []
    for (const route of routes) {
      frames.push(await captureRoute(page, baseUrl, route))
    }
    return mergeCapturedFrames(existingBoard, frames, `${project.id}-board`)
  } finally {
    await browser.close()
  }
}
