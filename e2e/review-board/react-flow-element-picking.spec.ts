import { expect, test, type Page } from '@playwright/test'
import type { BoardDocument } from '../../src/features/review-board/model/board-document.schema'
import { BOARD_SCHEMA_VERSION } from '../../src/features/review-board/model/board-document.schema'
import { installFakeBoardHost } from './install-fake-board-host'

interface Diagnostics {
  annotations: Array<{
    id: string
    frameId: string
    instruction: string
    mark: null | { kind: string; elementId?: string; label?: string }
  }>
}

function elementPickingBoard(): BoardDocument {
  const dataUrl = 'data:image/svg+xml;base64,PHN2Zy8+'
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    boardId: 'element-picking-board',
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
  }
}

async function board(page: Page): Promise<Diagnostics> {
  return JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '') as Diagnostics
}

async function elementPoint(page: Page, normalized: readonly [number, number]) {
  const rect = await page.getByTestId('surface-pick-frame').boundingBox()
  if (!rect) throw new Error('Pick frame surface missing')
  return { x: rect.x + rect.width * normalized[0], y: rect.y + rect.height * normalized[1] }
}

test('reactflow: select mode breaks the screen into design elements for commenting', async ({ page }) => {
  await installFakeBoardHost(page, elementPickingBoard())
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText('1 screen')
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible()

  // Hovering in select mode outlines the design element under the cursor.
  const ctaCenter = await elementPoint(page, [0.25, 0.175])
  await page.mouse.move(ctaCenter.x, ctaCenter.y)
  await expect(page.getByTestId('element-hover-pick-frame-el-1')).toBeVisible()
  await expect(page.getByTestId('element-hover-pick-frame-el-1')).toContainText('Pay now')

  // Clicking the element pools a comment bound to it and opens the editor.
  await page.mouse.click(ctaCenter.x, ctaCenter.y)
  await expect(page.getByTestId('annotation-count')).toHaveText('1 annotation')
  await expect(page.getByTestId('instruction-input')).toBeFocused()
  const created = (await board(page)).annotations.at(-1)!
  expect(created.mark).toMatchObject({ kind: 'element', elementId: 'pick-frame-el-1', label: 'Pay now' })
  await expect(page.getByTestId(`comment-item-${created.id}`)).toContainText('Pay now')

  // The pool collapses out of the way and reopens when a comment is picked again.
  await page.getByTestId('toggle-comments-panel').click()
  await expect(page.getByTestId(`comment-item-${created.id}`)).toHaveCount(0)

  // Picking the same element again returns to the existing note instead of duplicating it.
  await page.getByTestId('surface-pick-frame').click({ position: { x: 4, y: 4 } })
  await expect(page.getByTestId('selected-annotation')).toHaveText('none selected')
  await page.mouse.click(ctaCenter.x, ctaCenter.y)
  await expect(page.getByTestId('selected-annotation')).toHaveText(created.id)
  await expect(page.getByTestId('annotation-count')).toHaveText('1 annotation')
  await expect(page.getByTestId(`comment-item-${created.id}`)).toBeVisible()

  // A second element pools a second comment; copy-all validates the pool first.
  const paneCenter = await elementPoint(page, [0.7, 0.65])
  await page.mouse.click(paneCenter.x, paneCenter.y)
  await expect(page.getByTestId('annotation-count')).toHaveText('2 annotations')
  await page.getByTestId('instruction-input').fill('Simplify the order summary pane')

  await page.getByTestId('copy-all-comments').click()
  await expect(page.getByTestId('export-validation-error')).toContainText(created.id)

  await page.getByTestId(`open-comment-${created.id}`).click()
  await page.getByTestId('instruction-input').fill('Make the pay button the only primary action')
  await expect(page.getByTestId('export-validation-error')).toHaveCount(0)

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByTestId('copy-all-comments').click()
  await expect(page.getByTestId('copy-all-comments')).toHaveText('Copied')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  const pool = JSON.parse(copied) as { annotations: Array<{ elements: Array<{ label: string }> }> }
  expect(pool.annotations).toHaveLength(2)
  expect(pool.annotations[0]?.elements[0]?.label).toBe('Pay now')

  // Sending the pool delivers every comment through the host at once.
  await page.getByTestId('export-annotation').click()
  await expect(page.getByTestId('export-status')).toHaveText('Delivered')
  await expect(page.getByTestId('export-delivered-notice')).toContainText('2 annotations')
})
