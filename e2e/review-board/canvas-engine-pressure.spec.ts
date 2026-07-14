import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'
import { installFakeBoardHost } from './install-fake-board-host'

type CanvasEngine = 'reactflow' | 'excalidraw'

interface Diagnostics {
  camera: { worldX: number; worldY: number; zoom: number }
  frames: Array<{
    id: string
    x: number
    y: number
    width: number
    height: number
    aspectRatio: number
    revision: number
    captureHash: string
  }>
  annotations: Array<{
    id: string
    frameId: string
    anchor: readonly [number, number]
    mark: null | { points: readonly [readonly [number, number], readonly [number, number]] }
  }>
}

async function board(page: Page): Promise<Diagnostics> {
  return JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '') as Diagnostics
}

async function framePoint(
  page: Page,
  engine: CanvasEngine,
  frameId: string,
  normalized: readonly [number, number],
): Promise<{ x: number; y: number }> {
  if (engine === 'reactflow') {
    const rect = await page.getByTestId(`surface-${frameId}`).boundingBox()
    if (!rect) throw new Error(`No rendered surface for ${frameId}`)
    return { x: rect.x + rect.width * normalized[0], y: rect.y + rect.height * normalized[1] }
  }
  const document = await board(page)
  const frame = document.frames.find((item) => item.id === frameId)
  const canvas = await page.getByTestId('excal-pointer-layer').boundingBox()
  if (!frame || !canvas) throw new Error(`No Excalidraw surface for ${frameId}`)
  return {
    x: canvas.x + (frame.x - document.camera.worldX + frame.width * normalized[0]) * document.camera.zoom,
    y: canvas.y + (frame.y - document.camera.worldY + frame.height * normalized[1]) * document.camera.zoom,
  }
}

async function frameRect(page: Page, engine: CanvasEngine, frameId: string) {
  if (engine === 'reactflow') {
    const rect = await page.getByTestId(`surface-${frameId}`).boundingBox()
    if (!rect) throw new Error(`No rendered surface for ${frameId}`)
    return rect
  }
  const document = await board(page)
  const frame = document.frames.find((item) => item.id === frameId)
  const canvas = await page.getByTestId('excal-pointer-layer').boundingBox()
  if (!frame || !canvas) throw new Error(`No Excalidraw surface for ${frameId}`)
  return {
    x: canvas.x + (frame.x - document.camera.worldX) * document.camera.zoom,
    y: canvas.y + (frame.y - document.camera.worldY) * document.camera.zoom,
    width: frame.width * document.camera.zoom,
    height: frame.height * document.camera.zoom,
  }
}

async function pinkPixelCenter(page: Page, rect: { x: number; y: number; width: number; height: number }) {
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('The browser viewport size is unavailable')
  const clip = {
    x: Math.max(0, rect.x),
    y: Math.max(0, rect.y),
    width: Math.max(1, Math.min(rect.width, viewport.width - Math.max(0, rect.x))),
    height: Math.max(1, Math.min(rect.height, viewport.height - Math.max(0, rect.y))),
  }
  const png = PNG.sync.read(await page.screenshot({ clip }))
  let minX = png.width
  let minY = png.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (y * png.width + x) * 4
      const red = png.data[offset] ?? 0
      const green = png.data[offset + 1] ?? 0
      const blue = png.data[offset + 2] ?? 0
      if (red > 210 && green < 130 && blue < 175 && red - green > 90) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }
  if (maxX < 0 || maxY < 0) throw new Error('No painted pink annotation pixels were found')
  return [
    ((minX + maxX) / 2) / png.width,
    ((minY + maxY) / 2) / png.height,
  ] as const
}

async function renderedMarkPosition(
  page: Page,
  engine: CanvasEngine,
  frameId: string,
  annotationId: string,
): Promise<readonly [number, number]> {
  if (engine === 'reactflow') {
    const surface = await page.getByTestId(`surface-${frameId}`).boundingBox()
    const mark = await page.getByTestId(`mark-${annotationId}`).boundingBox()
    if (!surface || !mark) throw new Error('Rendered React Flow mark was not found')
    return [
      (mark.x + mark.width / 2 - surface.x) / surface.width,
      (mark.y + mark.height / 2 - surface.y) / surface.height,
    ]
  }
  void annotationId
  return pinkPixelCenter(page, await frameRect(page, engine, frameId))
}

async function selectFrame(page: Page, engine: CanvasEngine, frameId: string) {
  if (engine === 'reactflow') {
    await page.getByTestId(`surface-${frameId}`).click({ position: { x: 14, y: 14 } })
  } else {
    const point = await framePoint(page, engine, frameId, [0.82, 0.82])
    await page.mouse.click(point.x, point.y)
  }
  await expect(page.getByTestId('selected-frame')).toContainText(frameId)
}

for (const engine of ['reactflow', 'excalidraw'] as const) {
  test(`${engine}: 50 screen review flow with real pointer input`, async ({ page }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await installFakeBoardHost(page)
    const navigationStart = Date.now()
    await page.goto(`/?engine=${engine}`)
    await expect(page.getByTestId(`${engine}-canvas`)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('board-status')).toContainText('50 screens')
    const interactiveMs = Date.now() - navigationStart
    expect((await board(page)).frames).toHaveLength(50)

    const initial = await board(page)
    const initialCount = initial.annotations.length
    await page.getByTestId('tool-circle').click()
    const start = await framePoint(page, engine, 'frame-01', [0.18, 0.22])
    const end = await framePoint(page, engine, 'frame-01', [0.62, 0.68])
    const circleStarted = performance.now()
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 8 })
    await page.mouse.up()
    await expect(page.getByTestId('annotation-count')).toHaveText(`${initialCount + 1} annotations`)
    const circleMs = performance.now() - circleStarted

    const afterCircle = await board(page)
    const annotation = afterCircle.annotations.at(-1)
    expect(annotation?.frameId).toBe('frame-01')
    expect(annotation?.mark).not.toBeNull()
    const renderedBefore = await renderedMarkPosition(page, engine, 'frame-01', annotation!.id)
    expect(renderedBefore[0]).toBeCloseTo(annotation!.anchor[0], 2)
    expect(renderedBefore[1]).toBeCloseTo(annotation!.anchor[1], 2)

    await page.getByTestId('tool-select').click()
    const moveStart = await framePoint(page, engine, 'frame-01', [0.82, 0.82])
    await page.mouse.move(moveStart.x, moveStart.y)
    await page.mouse.down()
    await page.mouse.move(moveStart.x + 70, moveStart.y + 42, { steps: 8 })
    await page.mouse.up()
    await expect.poll(async () => (await board(page)).frames.find((item) => item.id === 'frame-01')?.x)
      .not.toBe(initial.frames.find((item) => item.id === 'frame-01')?.x)

    const afterMove = await board(page)
    const movedFrame = afterMove.frames.find((item) => item.id === 'frame-01')!
    const renderedAfter = await renderedMarkPosition(page, engine, 'frame-01', annotation!.id)
    const driftX = Math.abs(renderedAfter[0] - annotation!.anchor[0]) * movedFrame.width * afterMove.camera.zoom
    const driftY = Math.abs(renderedAfter[1] - annotation!.anchor[1]) * movedFrame.height * afterMove.camera.zoom
    expect(driftX).toBeLessThanOrEqual(2)
    expect(driftY).toBeLessThanOrEqual(2)

    const zoomBefore = afterMove.camera.zoom
    const zoomAt = await framePoint(page, engine, 'frame-01', annotation!.anchor)
    await page.mouse.move(zoomAt.x, zoomAt.y)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -160)
    await page.keyboard.up('Control')
    await expect.poll(async () => (await board(page)).camera.zoom).toBeGreaterThan(zoomBefore)
    const afterZoom = await board(page)
    const zoomedFrame = afterZoom.frames.find((item) => item.id === 'frame-01')!
    const renderedAfterZoom = await renderedMarkPosition(page, engine, 'frame-01', annotation!.id)
    const zoomDriftX = Math.abs(renderedAfterZoom[0] - annotation!.anchor[0]) * zoomedFrame.width * afterZoom.camera.zoom
    const zoomDriftY = Math.abs(renderedAfterZoom[1] - annotation!.anchor[1]) * zoomedFrame.height * afterZoom.camera.zoom
    expect(zoomDriftX).toBeLessThanOrEqual(2)
    expect(zoomDriftY).toBeLessThanOrEqual(2)

    await selectFrame(page, engine, 'frame-01')
    const beforeResize = (await board(page)).frames.find((item) => item.id === 'frame-01')!
    if (engine === 'reactflow') {
      const handle = page.locator('.react-flow__resize-control.handle.bottom.right')
      await expect(handle).toBeVisible()
      const box = await handle.boundingBox()
      if (!box) throw new Error('React Flow resize handle was not found')
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 40, { steps: 8 })
      await page.mouse.up()
    } else {
      const selection = page.getByTestId('excal-selection')
      await expect(selection).toBeVisible()
      const box = await selection.boundingBox()
      if (!box) throw new Error('Excalidraw selection was not found')
      const x = box.x + box.width + 3
      const y = box.y + box.height - 3
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + 70, y + 52.5, { steps: 8 })
      await page.mouse.up()
    }
    await expect.poll(async () => (await board(page)).frames.find((item) => item.id === 'frame-01')?.width)
      .toBeGreaterThan(beforeResize.width + 20)
    const resized = (await board(page)).frames.find((item) => item.id === 'frame-01')!
    expect(resized.width / resized.height).toBeCloseTo(resized.aspectRatio, 5)
    const renderedAfterResize = await renderedMarkPosition(page, engine, 'frame-01', annotation!.id)
    const resizeDriftX = Math.abs(renderedAfterResize[0] - annotation!.anchor[0]) * resized.width * (await board(page)).camera.zoom
    const resizeDriftY = Math.abs(renderedAfterResize[1] - annotation!.anchor[1]) * resized.height * (await board(page)).camera.zoom
    expect(resizeDriftX).toBeLessThanOrEqual(2)
    expect(resizeDriftY).toBeLessThanOrEqual(2)
    if (engine === 'excalidraw') {
      const scene = JSON.parse(await page.getByTestId('excal-scene-diagnostics').textContent() ?? '[]') as Array<{
        width: number
        height: number
        customData: { reviewKind?: string; frameId?: string }
      }>
      const paintedFrame = scene.find((item) => item.customData.reviewKind === 'frame' && item.customData.frameId === 'frame-01')
      expect(paintedFrame).toBeDefined()
      expect(paintedFrame!.width / paintedFrame!.height).toBeCloseTo(resized.aspectRatio, 2)
    }

    await page.getByTestId('save-board').click()
    await page.reload()
    await expect(page.getByTestId('annotation-count')).toHaveText(`${initialCount + 1} annotations`)
    const restored = await board(page)
    expect(restored.frames.find((item) => item.id === 'frame-01')?.width).toBeCloseTo(resized.width, 3)

    await page.getByTestId('export-annotation').click()
    const exported = JSON.parse(await page.getByTestId('export-output').textContent() ?? '') as {
      schemaVersion: number
      id: string
      frameId: string
      fullScreenshot: string
      marks: unknown[]
      madeAgainst: { captureHash: string }
    }
    expect(exported).toMatchObject({ schemaVersion: 1, id: annotation!.id, frameId: 'frame-01' })
    expect(exported.fullScreenshot).toBe('screens/frame-01.svg')
    expect(exported.marks).toHaveLength(1)

    await page.getByTestId('tool-select').click()
    await selectFrame(page, engine, 'frame-01')
    await page.getByTestId('focus-selected').click()
    await expect(page.getByTestId('focus-state')).toHaveText('live frame-01', { timeout: 15_000 })
    await expect(page.getByTestId('live-state-frame-01')).toHaveText('Live ready', { timeout: 15_000 })
    const liveFrame = page.frameLocator('[data-testid="live-iframe-frame-01"]')
    await liveFrame.locator('#increment').click()
    await expect(liveFrame.locator('#count')).toHaveText('1')
    await page.getByTestId('exit-focus').click()
    await expect(page.getByTestId('focus-state')).toHaveText('screenshot mode')
    if (engine === 'reactflow') {
      await page.getByTestId(`mark-${annotation!.id}`).click()
      await expect(page.getByTestId('annotation-stale')).toBeVisible()
    }
    const refreshedFrame = (await board(page)).frames.find((item) => item.id === 'frame-01')
    expect(refreshedFrame?.revision).toBe(2)
    expect(refreshedFrame?.captureHash).toContain('revision-2-host')
    await page.getByTestId('export-annotation').click()
    const afterRefreshExport = JSON.parse(await page.getByTestId('export-output').textContent() ?? '') as {
      madeAgainst: { captureHash: string }
    }
    expect(afterRefreshExport.madeAgainst.captureHash).toBe(exported.madeAgainst.captureHash)

    const cameraBeforePan = (await board(page)).camera
    const canvas = await page.getByTestId(`${engine}-canvas`).boundingBox()
    if (!canvas) throw new Error('Canvas was not found for pan test')
    await page.mouse.move(canvas.x + canvas.width * 0.72, canvas.y + canvas.height * 0.72)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(canvas.x + canvas.width * 0.72 - 100, canvas.y + canvas.height * 0.72 - 80, { steps: 8 })
    await page.mouse.up({ button: 'middle' })
    await expect.poll(async () => (await board(page)).camera.worldX).not.toBeCloseTo(cameraBeforePan.worldX, 1)

    const browserMetrics = await page.evaluate(() => ({
      domNodes: document.querySelectorAll('*').length,
      resources: performance.getEntriesByType('resource').length,
      transferBytes: performance.getEntriesByType('resource')
        .reduce((total, entry) => total + ((entry as PerformanceResourceTiming).transferSize || 0), 0),
      heapBytes: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
      readyMs: Number(document.querySelector('[data-testid="ready-ms"]')?.textContent?.replace(' ms', '')),
    }))
    const output = path.resolve('.canvas-results')
    mkdirSync(output, { recursive: true })
    writeFileSync(path.join(output, `${engine}-runtime.json`), JSON.stringify({
      engine,
      interactiveMs,
      circleMs,
      driftCssPx: {
        afterMove: { x: driftX, y: driftY },
        afterZoom: { x: zoomDriftX, y: zoomDriftY },
        afterResize: { x: resizeDriftX, y: resizeDriftY },
        excalidrawSource: engine === 'excalidraw' ? 'painted screenshot pixels' : 'DOM layout box',
      },
      browser: browserMetrics,
      errors: { console: consoleErrors, page: pageErrors },
    }, null, 2))

    expect(pageErrors).toEqual([])
    expect(consoleErrors.filter((message) => !message.includes('Download the React DevTools'))).toEqual([])
  })
}

test('fake host loads valid boards and bad messages keep the current board', async ({ page }) => {
  await installFakeBoardHost(page)
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText('50 screens')
  const initialBoardId = JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '').frames[0].id

  await page.evaluate(() => window.postMessage({
    type: 'design-review/load-board',
    schemaVersion: 1,
    board: { schemaVersion: 1, boardId: 'broken', camera: {}, frames: [], annotations: [] },
  }, window.location.origin))
  await expect(page.getByTestId('board-load-error')).toContainText('Invalid board data')
  await expect(page.getByTestId('board-status')).toContainText('50 screens')
  expect(JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '').frames[0].id).toBe(initialBoardId)

  await page.evaluate(() => window.postMessage({
    type: 'design-review/load-board',
    schemaVersion: 1,
    board: { schemaVersion: 2 },
  }, window.location.origin))
  await expect(page.getByTestId('board-load-error')).toHaveText('Unsupported board schema version 2. This app supports version 1.')
  await expect(page.getByTestId('board-status')).toContainText('50 screens')
})
