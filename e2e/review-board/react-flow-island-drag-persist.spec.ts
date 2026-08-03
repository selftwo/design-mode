import { expect, test, type Page } from '@playwright/test'
import type { BoardDocument } from '../../src/features/review-board/model/board-document.schema'
import { BOARD_SCHEMA_VERSION } from '../../src/features/review-board/model/board-document.schema'
import { installFakeBoardHost } from './install-fake-board-host'

function islandDragBoard(): BoardDocument {
  const dataUrl = 'data:image/svg+xml;base64,PHN2Zy8+'
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    boardId: 'island-drag-board',
    documentRevision: 1,
    camera: { worldX: 0, worldY: -60, zoom: 1 },
    frames: [
      {
        id: 'pick-frame',
        label: 'Checkout',
        route: '/checkout',
        viewport: { width: 800, height: 600 },
        x: 120,
        y: 80,
        width: 400,
        height: 300,
        aspectRatio: 4 / 3,
        screenshotPath: 'screens/checkout.svg',
        screenshotDataUrl: dataUrl,
        refreshedScreenshotDataUrl: dataUrl,
        captureHash: 'pick-capture',
        revision: 1,
        kind: 'captured-route',
        lifeState: 'active',
        elements: [
          {
            id: 'pick-frame-el-1',
            label: 'Pay now',
            role: 'button',
            bounds: [[0.1, 0.1], [0.4, 0.25]],
          },
          {
            id: 'pick-frame-el-2',
            label: 'Order summary pane',
            role: 'aside',
            bounds: [[0.5, 0.4], [0.95, 0.9]],
          },
        ],
      },
    ],
    annotations: [],
    units: [],
    zones: [],
    verdicts: [],
    reviewSummaries: [],
  }
}

async function elementPoint(page: Page, normalized: readonly [number, number]) {
  const rect = await page.getByTestId('surface-pick-frame').boundingBox()
  if (!rect) throw new Error('Pick frame surface missing')
  return { x: rect.x + rect.width * normalized[0], y: rect.y + rect.height * normalized[1] }
}

async function islandPosition(page: Page) {
  const box = await page.getByTestId('summoned-inspector-island').boundingBox()
  if (!box) throw new Error('Summoned inspector island missing')
  return { left: box.x, top: box.y }
}

test('reactflow: dragging a summoned island holds placement across a new selection', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await installFakeBoardHost(page, islandDragBoard())
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible()

  await page.getByTestId('surface-pick-frame').click({ position: { x: 8, y: 8 } })
  await expect(page.getByTestId('summoned-inspector-island')).toHaveAttribute('data-open', 'true')

  const head = page.getByTestId('summoned-inspector-island-head')
  const beforeDrag = await islandPosition(page)
  const headBox = await head.boundingBox()
  if (!headBox) throw new Error('Island head missing')
  await page.mouse.move(headBox.x + headBox.width / 2, headBox.y + headBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(headBox.x + headBox.width / 2 + 120, headBox.y + headBox.height / 2 + 80, { steps: 8 })
  await page.mouse.up()

  const afterDrag = await islandPosition(page)
  expect(pageErrors).toEqual([])

  const hoverLeft = headBox.x + 4
  const hoverRight = headBox.x + headBox.width - 4
  const hoverY = headBox.y + headBox.height / 2
  await page.mouse.move(hoverLeft, hoverY)
  await page.mouse.move(hoverRight, hoverY, { steps: 6 })
  const afterHover = await islandPosition(page)
  expect(Math.abs(afterHover.left - afterDrag.left)).toBeLessThan(2)
  expect(Math.abs(afterHover.top - afterDrag.top)).toBeLessThan(2)
  expect(pageErrors).toEqual([])
  expect(Math.hypot(afterDrag.left - beforeDrag.left, afterDrag.top - beforeDrag.top)).toBeGreaterThan(40)

  const paneCenter = await elementPoint(page, [0.7, 0.65])
  await page.mouse.click(paneCenter.x, paneCenter.y)
  await expect(page.getByTestId('selected-annotation')).not.toHaveText('none selected')

  const afterSecondSelection = await islandPosition(page)
  expect(Math.abs(afterSecondSelection.left - afterDrag.left)).toBeLessThan(2)
  expect(Math.abs(afterSecondSelection.top - afterDrag.top)).toBeLessThan(2)
})

test('reactflow: deselect and reselect re-enables dodge for a summoned island', async ({ page }) => {
  await installFakeBoardHost(page, islandDragBoard())
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible()

  const ctaCenter = await elementPoint(page, [0.25, 0.175])
  await page.mouse.click(ctaCenter.x, ctaCenter.y)
  const head = page.getByTestId('summoned-inspector-island-head')
  const headBox = await head.boundingBox()
  if (!headBox) throw new Error('Island head missing')
  await page.mouse.move(headBox.x + headBox.width / 2, headBox.y + headBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(headBox.x + headBox.width / 2 + 100, headBox.y + headBox.height / 2 + 60, { steps: 8 })
  await page.mouse.up()
  const dragged = await islandPosition(page)

  await page.locator('.react-flow__pane').click({ position: { x: 24, y: 24 } })
  await expect(page.getByTestId('selected-annotation')).toHaveText('none selected')
  await expect(page.getByTestId('selected-frame')).toHaveText('none selected')
  await expect(page.getByTestId('summoned-inspector-island')).toHaveAttribute('data-open', 'false')

  await page.mouse.click(ctaCenter.x, ctaCenter.y)
  await expect(page.getByTestId('summoned-inspector-island')).toHaveAttribute('data-open', 'true')
  const dodgedAgain = await islandPosition(page)
  expect(Math.hypot(dodgedAgain.left - dragged.left, dodgedAgain.top - dragged.top)).toBeGreaterThan(24)
})

test('reactflow: arrow keys nudge a focused summoned island', async ({ page }) => {
  await installFakeBoardHost(page, islandDragBoard())
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible()

  const ctaCenter = await elementPoint(page, [0.25, 0.175])
  await page.mouse.click(ctaCenter.x, ctaCenter.y)
  const before = await islandPosition(page)
  const head = page.getByTestId('summoned-inspector-island-head')
  await head.focus()
  await head.press('ArrowLeft')
  const after = await islandPosition(page)
  expect(before.left - after.left).toBeGreaterThanOrEqual(7)
})
