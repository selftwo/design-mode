import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'
import type { BoardDocument } from '../../src/features/review-board/model/board-document.schema'
import { BOARD_SCHEMA_VERSION } from '../../src/features/review-board/model/board-document.schema'
import { installFakeBoardHost } from './install-fake-board-host'

function importBoard(): BoardDocument {
  const dataUrl = 'data:image/svg+xml;base64,PHN2Zy8+'
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    boardId: 'import-intent-board',
    camera: { worldX: 0, worldY: -60, zoom: 1 },
    frames: [
      {
        id: 'seed-frame',
        label: 'Seed screen',
        route: '/seed',
        viewport: { width: 800, height: 600 },
        x: 60,
        y: 80,
        width: 360,
        height: 270,
        aspectRatio: 4 / 3,
        screenshotPath: 'screens/seed.svg',
        screenshotDataUrl: dataUrl,
        refreshedScreenshotDataUrl: dataUrl,
        captureHash: 'seed-capture',
        revision: 1,
        elements: [],
      },
    ],
    annotations: [],
  }
}

function pngBuffer(width: number, height: number): Buffer {
  const png = new PNG({ width, height })
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = 226
    png.data[index + 1] = 232
    png.data[index + 2] = 255
    png.data[index + 3] = 255
  }
  return PNG.sync.write(png)
}

test('reactflow: imported images become annotatable frames with design intents', async ({ page }) => {
  await installFakeBoardHost(page, importBoard())
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText('1 screen')

  // A dropped or picked image joins the board as a normal frame.
  await page.getByTestId('import-images-input').setInputFiles({
    name: 'pricing-mock.png',
    mimeType: 'image/png',
    buffer: pngBuffer(1200, 750),
  })
  await expect(page.getByTestId('board-status')).toContainText('2 screens')
  const uploaded = page.locator('[data-testid^="surface-upload-"]')
  await expect(uploaded).toBeVisible()

  // The uploaded frame accepts comments like any captured screen.
  await page.getByTestId('tool-comment').click()
  const rect = await uploaded.boundingBox()
  if (!rect) throw new Error('Uploaded frame surface missing')
  await page.mouse.click(rect.x + rect.width * 0.5, rect.y + rect.height * 0.5)
  await expect(page.getByTestId('annotation-count')).toHaveText('1 annotation')
  await page.getByTestId('instruction-input').fill('Align the pricing tiers to one baseline grid')

  // A design intent rides along with the comment and into the export.
  await page.getByTestId('intent-typeset').click()
  await expect(page.getByTestId('intent-typeset')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('export-annotation').click()
  await expect(page.getByTestId('export-status')).toHaveText('Delivered')
  const exported = JSON.parse(await page.getByTestId('export-output').textContent() ?? '') as {
    annotations: Array<{ intent?: string; fullScreenshot: string }>
  }
  expect(exported.annotations[0]?.intent).toBe('typeset')
  expect(exported.annotations[0]?.fullScreenshot).toBe('uploads/pricing-mock.png')

  // Clicking the active chip clears the intent again.
  await page.getByTestId('intent-typeset').click()
  await expect(page.getByTestId('intent-typeset')).toHaveAttribute('aria-pressed', 'false')
})
