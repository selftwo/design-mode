import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

const projectDir = process.env.WEATHER_CUFC_DIR ?? '/Users/corphr.software/Documents/work/weather-CUFC'
const devPort = Number(process.env.WEATHER_CUFC_PORT ?? 5183)
const devUrl = `http://localhost:${devPort}`
const outFile = path.resolve('test-fixtures/manual-host/weather-cufc-board.json')

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const response = await fetch(url)
        if (response.ok || response.status < 500) {
          resolve()
          return
        }
      } catch {
        // server not ready yet
      }
      if (Date.now() > deadline) {
        reject(new Error(`Timed out waiting for ${url}`))
        return
      }
      setTimeout(attempt, 300)
    }
    attempt()
  })
}

// Break the page into design elements so the canvas can pick a CTA, pane, or
// heading instead of a bare pixel position. Runs against the live DOM at capture
// time, which is the only place real element bounds exist.
async function extractFrameElements(page, frameId) {
  return page.evaluate((prefix) => {
    const selectors = [
      'button', 'a[href]', 'input', 'select', 'textarea', 'table',
      '[role="button"]', '[role="tab"]', '[role="menuitem"]', '[role="dialog"]', '[role="listbox"]',
      'nav', 'aside', 'header', 'footer', 'h1', 'h2', 'h3',
    ].join(', ')
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const clamp = (value) => Math.min(1, Math.max(0, value))
    const compact = (text) => {
      const flat = (text ?? '').trim().replace(/\s+/g, ' ')
      return flat.length > 60 ? `${flat.slice(0, 57)}...` : flat
    }
    // Containers concatenate every child's text, so name them by kind and heading instead.
    const containerNames = { NAV: 'Navigation', ASIDE: 'Side pane', HEADER: 'Header', FOOTER: 'Footer', TABLE: 'Table' }
    const labelFor = (element) => {
      const aria = compact(element.getAttribute('aria-label'))
      if (aria) return aria
      const containerName = containerNames[element.tagName]
        ?? (element.getAttribute('role') === 'dialog' ? 'Dialog' : null)
      if (containerName) {
        const heading = compact(element.querySelector('h1, h2, h3, [role="heading"]')?.textContent)
        return heading ? `${containerName}: ${heading}` : containerName
      }
      return compact(element.getAttribute('placeholder')) || compact(element.textContent) || element.tagName.toLowerCase()
    }
    const elements = []
    let counter = 0
    for (const element of document.querySelectorAll(selectors)) {
      const rect = element.getBoundingClientRect()
      if (rect.width < 12 || rect.height < 10) continue
      if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= viewportWidth || rect.top >= viewportHeight) continue
      const style = getComputedStyle(element)
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue
      counter += 1
      elements.push({
        id: `${prefix}-el-${counter}`,
        label: labelFor(element),
        role: element.getAttribute('role') || element.tagName.toLowerCase(),
        bounds: [
          [clamp(rect.left / viewportWidth), clamp(rect.top / viewportHeight)],
          [clamp(rect.right / viewportWidth), clamp(rect.bottom / viewportHeight)],
        ],
      })
    }
    return elements
  }, frameId)
}

async function captureScreen(page, { id, label, route, navLabel }) {
  if (navLabel) {
    await page.getByRole('button', { name: navLabel, exact: true }).click()
    await page.waitForTimeout(400)
  }
  const elements = await extractFrameElements(page, id)
  const buffer = await page.screenshot({ fullPage: false })
  const width = 1440
  const height = 900
  const aspectRatio = width / height
  const displayWidth = 420
  const displayHeight = displayWidth / aspectRatio
  return {
    id,
    label,
    route,
    viewport: { width, height },
    x: 0,
    y: 0,
    width: displayWidth,
    height: displayHeight,
    aspectRatio,
    screenshotPath: `screens/${id}.png`,
    screenshotDataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
    refreshedScreenshotDataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
    captureHash: `${id}-revision-1`,
    revision: 1,
    elements,
  }
}

async function main() {
  process.stdout.write(`Starting weather-CUFC dev server in ${projectDir}...\n`)
  const devServer = spawn('npm', ['run', 'dev', '--', '--port', String(devPort), '--strictPort'], {
    cwd: projectDir,
    stdio: 'inherit',
  })

  const stopDevServer = () => {
    if (!devServer.killed) devServer.kill('SIGTERM')
  }
  process.on('exit', stopDevServer)

  try {
    await waitForServer(devUrl, 30_000)

    const browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(devUrl, { waitUntil: 'networkidle' })

    const frames = []
    frames.push(await captureScreen(page, {
      id: 'weather-cufc-site',
      label: 'Plant planner: site selection',
      route: '/',
    }))
    frames.push(await captureScreen(page, {
      id: 'weather-cufc-scenarios',
      label: 'Scenarios',
      route: '/scenarios',
      navLabel: 'Scenarios',
    }))
    frames.push(await captureScreen(page, {
      id: 'weather-cufc-sources',
      label: 'Data sources',
      route: '/sources',
      navLabel: 'Data sources',
    }))

    await browser.close()

    // Lay the captured frames out left to right on the canvas.
    let cursorX = 0
    for (const frame of frames) {
      frame.x = cursorX
      frame.y = 0
      cursorX += frame.width + 80
    }

    const board = {
      schemaVersion: 1,
      boardId: 'weather-cufc-manual-test',
      camera: { worldX: 0, worldY: -80, zoom: 0.8 },
      frames,
      annotations: [],
    }

    await writeFile(outFile, JSON.stringify(board, null, 2))
    process.stdout.write(`Wrote board with ${frames.length} captured screens to ${outFile}\n`)
  } finally {
    stopDevServer()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
