import { expect, test, type Page } from '@playwright/test'
import { createPressureTestBoard } from '../../src/test-support/create-pressure-test-board'

interface Diagnostics {
  camera: { worldX: number; worldY: number; zoom: number }
  frames: Array<{ id: string; x: number; y: number; width: number; height: number }>
  annotations: Array<{
    id: string
    frameId: string
    instruction: string
    anchor: readonly [number, number]
    mark: null | { points: readonly [readonly [number, number], readonly [number, number]] }
  }>
}

async function installFakeBoardHost(page: Page) {
  const pressureBoard = createPressureTestBoard()
  await page.addInitScript((boardDocument) => {
    window.addEventListener('message', (event) => {
      if (event.source !== window || event.data?.type !== 'design-review/request-board') return
      window.postMessage({
        type: 'design-review/load-board',
        schemaVersion: 1,
        board: boardDocument,
      }, window.location.origin)
    })
  }, pressureBoard)
}

async function board(page: Page): Promise<Diagnostics> {
  return JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '') as Diagnostics
}

async function framePoint(
  page: Page,
  frameId: string,
  normalized: readonly [number, number],
): Promise<{ x: number; y: number }> {
  const rect = await page.getByTestId(`surface-${frameId}`).boundingBox()
  if (!rect) throw new Error(`No rendered surface for ${frameId}`)
  return { x: rect.x + rect.width * normalized[0], y: rect.y + rect.height * normalized[1] }
}

async function clickMarkCenter(page: Page, annotationId: string) {
  const mark = await page.getByTestId(`mark-${annotationId}`).boundingBox()
  if (!mark) throw new Error(`Mark ${annotationId} was not rendered`)
  await page.mouse.click(mark.x + mark.width / 2, mark.y + mark.height / 2)
}

async function renderedMarkPosition(
  page: Page,
  frameId: string,
  annotationId: string,
): Promise<readonly [number, number]> {
  const surface = await page.getByTestId(`surface-${frameId}`).boundingBox()
  const mark = await page.getByTestId(`mark-${annotationId}`).boundingBox()
  if (!surface || !mark) throw new Error('Rendered React Flow mark was not found')
  return [
    (mark.x + mark.width / 2 - surface.x) / surface.width,
    (mark.y + mark.height / 2 - surface.y) / surface.height,
  ]
}

test('reactflow: create, edit, select, delete annotations with stable marks', async ({ page }) => {
  test.setTimeout(120_000)
  await installFakeBoardHost(page)
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText('50 screens', { timeout: 30_000 })
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible()
  const initial = await board(page)
  const initialCount = initial.annotations.length

  await page.getByTestId('tool-circle').click()
  const reviewFrame = 'frame-01'
  const circleStart = await framePoint(page, reviewFrame, [0.55, 0.55])
  const circleEnd = await framePoint(page, reviewFrame, [0.78, 0.78])
  await page.mouse.move(circleStart.x, circleStart.y)
  await page.mouse.down()
  await page.mouse.move(circleEnd.x, circleEnd.y, { steps: 8 })
  await page.mouse.up()

  await expect.poll(async () => (await board(page)).annotations.length).toBe(initialCount + 1)
  await expect(page.getByTestId('selected-annotation')).not.toHaveText('none selected')
  await expect(page.getByTestId('annotation-instruction-editor')).toBeVisible()
  await expect(page.getByTestId('instruction-input')).toBeFocused()
  await expect(page.getByTestId('instruction-incomplete')).toBeVisible()
  await expect(page.getByTestId('annotation-count')).toHaveText(`${initialCount + 1} annotations`)

  const afterCircle = await board(page)
  const circle = afterCircle.annotations.at(-1)!
  expect(circle.instruction).toBe('')
  expect(circle.mark).not.toBeNull()
  await expect(page.getByTestId('selected-annotation')).toHaveText(circle.id)

  await page.getByTestId('instruction-input').fill('Check spacing inside the circled header')
  await expect(page.getByTestId('instruction-complete')).toBeVisible()
  await expect.poll(async () => (await board(page)).annotations.at(-1)?.instruction)
    .toBe('Check spacing inside the circled header')

  const renderedBefore = await renderedMarkPosition(page, reviewFrame, circle.id)
  expect(renderedBefore[0]).toBeCloseTo(circle.anchor[0], 2)
  expect(renderedBefore[1]).toBeCloseTo(circle.anchor[1], 2)

  await page.getByTestId('tool-select').click()
  const dragHandle = await framePoint(page, reviewFrame, [0.86, 0.86])
  await page.mouse.move(dragHandle.x, dragHandle.y)
  await page.mouse.down()
  await page.mouse.move(dragHandle.x + 64, dragHandle.y + 38, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await board(page)).frames.find((item) => item.id === reviewFrame)?.x)
    .not.toBe(initial.frames.find((item) => item.id === reviewFrame)?.x)

  const afterMove = await board(page)
  const movedFrame = afterMove.frames.find((item) => item.id === reviewFrame)!
  const renderedAfterMove = await renderedMarkPosition(page, reviewFrame, circle.id)
  expect(Math.abs(renderedAfterMove[0] - circle.anchor[0]) * movedFrame.width * afterMove.camera.zoom).toBeLessThanOrEqual(2)
  expect(Math.abs(renderedAfterMove[1] - circle.anchor[1]) * movedFrame.height * afterMove.camera.zoom).toBeLessThanOrEqual(2)

  const zoomBefore = afterMove.camera.zoom
  const zoomAt = await framePoint(page, reviewFrame, circle.anchor)
  await page.mouse.move(zoomAt.x, zoomAt.y)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -160)
  await page.keyboard.up('Control')
  await expect.poll(async () => (await board(page)).camera.zoom).toBeGreaterThan(zoomBefore)
  const afterZoom = await board(page)
  const zoomedFrame = afterZoom.frames.find((item) => item.id === reviewFrame)!
  const renderedAfterZoom = await renderedMarkPosition(page, reviewFrame, circle.id)
  expect(Math.abs(renderedAfterZoom[0] - circle.anchor[0]) * zoomedFrame.width * afterZoom.camera.zoom).toBeLessThanOrEqual(2)
  expect(Math.abs(renderedAfterZoom[1] - circle.anchor[1]) * zoomedFrame.height * afterZoom.camera.zoom).toBeLessThanOrEqual(2)

  await page.getByTestId(`surface-${reviewFrame}`).click({ position: { x: 12, y: 12 } })
  await expect(page.getByTestId('selected-frame')).toContainText(reviewFrame)
  const handle = page.locator('.react-flow__resize-control.handle.bottom.right')
  await expect(handle).toBeVisible()
  const box = await handle.boundingBox()
  if (!box) throw new Error('React Flow resize handle was not found')
  const widthBefore = (await board(page)).frames.find((item) => item.id === reviewFrame)!.width
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 72, box.y + box.height / 2 + 42, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await board(page)).frames.find((item) => item.id === reviewFrame)?.width)
    .toBeGreaterThan(widthBefore + 20)
  const resized = (await board(page)).frames.find((item) => item.id === reviewFrame)!
  const renderedAfterResize = await renderedMarkPosition(page, reviewFrame, circle.id)
  const zoomLevel = (await board(page)).camera.zoom
  expect(Math.abs(renderedAfterResize[0] - circle.anchor[0]) * resized.width * zoomLevel).toBeLessThanOrEqual(2)
  expect(Math.abs(renderedAfterResize[1] - circle.anchor[1]) * resized.height * zoomLevel).toBeLessThanOrEqual(2)

  const cameraBeforePan = (await board(page)).camera
  const canvas = await page.getByTestId('reactflow-canvas').boundingBox()
  if (!canvas) throw new Error('Canvas was not found for pan test')
  await page.mouse.move(canvas.x + canvas.width * 0.7, canvas.y + canvas.height * 0.7)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(canvas.x + canvas.width * 0.7 - 96, canvas.y + canvas.height * 0.7 - 72, { steps: 8 })
  await page.mouse.up({ button: 'middle' })
  await expect.poll(async () => (await board(page)).camera.worldX).not.toBeCloseTo(cameraBeforePan.worldX, 1)
  const afterPan = await board(page)
  const panFrame = afterPan.frames.find((item) => item.id === reviewFrame)!
  const renderedAfterPan = await renderedMarkPosition(page, reviewFrame, circle.id)
  expect(Math.abs(renderedAfterPan[0] - circle.anchor[0]) * panFrame.width * afterPan.camera.zoom).toBeLessThanOrEqual(2)
  expect(Math.abs(renderedAfterPan[1] - circle.anchor[1]) * panFrame.height * afterPan.camera.zoom).toBeLessThanOrEqual(2)

  await page.getByTestId('tool-comment').click()
  await expect(page.getByTestId('tool-comment')).toHaveAttribute('aria-pressed', 'true')
  const commentAt = await framePoint(page, reviewFrame, [0.2, 0.75])
  await page.mouse.move(commentAt.x, commentAt.y)
  await page.mouse.down()
  await page.mouse.up()
  await expect(page.getByTestId('instruction-input')).toBeFocused()
  await expect(page.getByTestId('instruction-incomplete')).toBeVisible()
  const afterComment = await board(page)
  const comment = afterComment.annotations.at(-1)!
  expect(comment.mark).toBeNull()
  await expect(page.getByTestId('selected-annotation')).toHaveText(comment.id)

  await page.getByTestId('tool-select').click()
  await clickMarkCenter(page, comment.id)
  await expect(page.getByTestId('selected-annotation')).toHaveText(comment.id)
  const countBeforeDelete = (await board(page)).annotations.length
  await page.getByTestId('delete-annotation').click()
  await expect(page.getByTestId('annotation-count')).toHaveText(`${countBeforeDelete - 1} annotations`)
  await expect(page.getByTestId('selected-annotation')).toHaveText('none selected')
  await expect(page.getByTestId('annotation-instruction-editor')).toHaveCount(0)

  await clickMarkCenter(page, circle.id)
  await page.getByTestId('instruction-input').fill('   ')
  await expect(page.getByTestId('instruction-incomplete')).toBeVisible()
})