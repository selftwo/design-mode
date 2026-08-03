import { expect, test, type Page } from '@playwright/test'
import type { BoardDocument } from '../../src/features/review-board/model/board-document.schema'
import { BOARD_SCHEMA_VERSION } from '../../src/features/review-board/model/board-document.schema'
import { installFakeBoardHost } from './install-fake-board-host'

function centeredDodgeBoard(): BoardDocument {
  const dataUrl = 'data:image/svg+xml;base64,PHN2Zy8+'
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    boardId: 'island-dodge-board',
    camera: { worldX: 0, worldY: 0, zoom: 1 },
    frames: [
      {
        id: 'center-frame',
        label: 'Centered checkout',
        route: '/checkout',
        viewport: { width: 800, height: 600 },
        x: 440,
        y: 210,
        width: 400,
        height: 300,
        aspectRatio: 4 / 3,
        screenshotPath: 'screens/centered.svg',
        screenshotDataUrl: dataUrl,
        refreshedScreenshotDataUrl: dataUrl,
        captureHash: 'center-capture',
        revision: 1,
        elements: [
          {
            id: 'center-frame-el',
            label: 'Plan keep',
            role: 'button',
            bounds: [[0.35, 0.35], [0.65, 0.65]],
          },
        ],
      },
    ],
    annotations: [],
  }
}

function rectsOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean {
  return left.x < right.x + right.width
    && right.x < left.x + left.width
    && left.y < right.y + right.height
    && right.y < left.y + left.height
}

async function elementPoint(page: Page, normalized: readonly [number, number]) {
  const rect = await page.getByTestId('surface-center-frame').boundingBox()
  if (!rect) throw new Error('Center frame surface missing')
  return { x: rect.x + rect.width * normalized[0], y: rect.y + rect.height * normalized[1] }
}

test('reactflow: a summoned island dodges a centered selection and stays on canvas', async ({ page }) => {
  await installFakeBoardHost(page, centeredDodgeBoard())
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible()

  const center = await elementPoint(page, [0.5, 0.5])
  await page.mouse.click(center.x, center.y)
  await expect(page.getByTestId('summoned-inspector-island')).toHaveAttribute('data-open', 'true')

  const island = await page.getByTestId('summoned-inspector-island').boundingBox()
  const annotationId = await page.getByTestId('selected-annotation').getAttribute('title')
  const selection = await page.getByTestId(`mark-${annotationId}`).boundingBox()
  const viewport = page.viewportSize()
  if (!island || !selection || !viewport) throw new Error('Missing layout boxes for dodge assertion')

  expect(rectsOverlap(island, selection)).toBe(false)
  expect(island.x).toBeGreaterThanOrEqual(0)
  expect(island.y).toBeGreaterThanOrEqual(0)
  expect(island.x + island.width).toBeLessThanOrEqual(viewport.width)
  expect(island.y + island.height).toBeLessThanOrEqual(viewport.height)

  const islandOnRight = island.x >= selection.x + selection.width - 1
  const islandOnLeft = island.x + island.width <= selection.x + 1
  expect(islandOnRight || islandOnLeft).toBe(true)
})
