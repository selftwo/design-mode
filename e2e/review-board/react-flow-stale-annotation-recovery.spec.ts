import { expect, test } from '@playwright/test'
import type { BoardDocument } from '../../src/features/review-board/model/board-document.schema'
import { BOARD_SCHEMA_VERSION } from '../../src/features/review-board/model/board-document.schema'
import { installFakeBoardHost } from './install-fake-board-host'

function staleDraftBoard(): BoardDocument {
  const dataUrl = 'data:image/svg+xml;base64,PHN2Zy8+'
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    boardId: 'stale-draft-board',
    camera: { worldX: 0, worldY: 0, zoom: 1 },
    frames: [
      {
        id: 'frame-01',
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
        captureHash: 'checkout-revision-2',
        revision: 2,
        elements: [],
      },
    ],
    annotations: [
      {
        kind: 'review',
        id: 'stale-draft-1',
        status: 'draft',
        instruction: '',
        frameId: 'frame-01',
        anchor: [0.4, 0.4],
        mark: null,
        createdAt: new Date().toISOString(),
        madeAgainstCaptureHash: 'checkout-revision-1',
        madeAgainstRevision: 1,
      },
      {
        kind: 'review',
        id: 'ready-export-1',
        status: 'draft',
        instruction: 'Keep the checkout header contrast high',
        frameId: 'frame-01',
        anchor: [0.2, 0.2],
        mark: null,
        createdAt: new Date().toISOString(),
        madeAgainstCaptureHash: 'checkout-revision-2',
        madeAgainstRevision: 2,
      },
    ],
  }
}

test('reactflow: stale incomplete annotations can be deleted from the bloom to unblock export', async ({ page }) => {
  await installFakeBoardHost(page, staleDraftBoard())
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible()

  await page.getByTestId('open-comment-stale-draft-1').click()
  await expect(page.getByTestId('annotation-stale')).toBeVisible()
  await expect(page.getByTestId('instruction-incomplete')).toBeVisible()
  await expect(page.getByTestId('delete-annotation')).toBeVisible()

  await page.getByTestId('export-annotation').click()
  await expect(page.getByTestId('export-validation-error')).toContainText('stale-draft-1')

  await page.getByTestId('delete-annotation').click()
  await expect(page.getByTestId('annotation-count')).toHaveText('1 annotation')

  await page.getByTestId('export-annotation').click()
  await expect(page.getByTestId('export-status')).toHaveText('Delivered')
})
