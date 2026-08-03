import { expect, test, type Page } from '@playwright/test'
import type { BoardDocument } from '../../src/features/review-board/model/board-document.schema'
import { BOARD_SCHEMA_VERSION } from '../../src/features/review-board/model/board-document.schema'
import { installFakeBoardHost } from './install-fake-board-host'

function teachBoard(): BoardDocument {
  const dataUrl = 'data:image/svg+xml;base64,PHN2Zy8+'
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    boardId: 'teach-annotation-board',
    documentRevision: 1,
    camera: { worldX: 0, worldY: -60, zoom: 1 },
    frames: [
      {
        id: 'teach-frame',
        label: 'Pricing',
        route: '/pricing',
        viewport: { width: 800, height: 600 },
        x: 120,
        y: 80,
        width: 400,
        height: 300,
        aspectRatio: 4 / 3,
        screenshotPath: 'screens/pricing.svg',
        screenshotDataUrl: dataUrl,
        refreshedScreenshotDataUrl: dataUrl,
        captureHash: 'teach-capture',
        revision: 1,
        kind: 'captured-route',
        lifeState: 'active',
        elements: [
          {
            id: 'teach-el-card',
            label: 'plan-keep',
            role: 'group',
            bounds: [[0.58, 0.18], [0.94, 0.88]],
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
  const rect = await page.getByTestId('surface-teach-frame').boundingBox()
  if (!rect) throw new Error('Teach frame surface missing')
  return { x: rect.x + rect.width * normalized[0], y: rect.y + rect.height * normalized[1] }
}

test('reactflow: pinning a learn-lens answer creates a teal teach note with the provenance glyph', async ({ page }) => {
  await installFakeBoardHost(page, teachBoard())
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible()

  await page.getByTestId('tool-learn').click()
  const cardCenter = await elementPoint(page, [0.76, 0.45])
  await page.mouse.click(cardCenter.x, cardCenter.y)
  await expect(page.getByTestId('learn-lens-sub')).toHaveText('▢ plan-keep')

  await page.getByTestId('learn-question-input').fill('Why does this card read heavier than the others?')
  await page.getByTestId('learn-question-submit').click()
  await expect(page.getByTestId('learn-answer-text')).toContainText('solid-ink block')

  await page.getByTestId('learn-pin-answer').click()
  await expect(page.getByTestId('learn-pinned-status')).toContainText('pinned to canvas')

  const teachNote = page.locator('[data-testid^="teach-note-"]').first()
  await expect(teachNote).toBeVisible()
  await expect(teachNote).toHaveClass(/dm-teach-note/)
  await expect(teachNote.locator('[data-testid^="teach-provenance-"]')).toContainText('⌁')
  await expect(teachNote.locator('[data-testid^="teach-chip-"]')).toContainText('⌁ teach')

  const chipColor = await teachNote.locator('[data-testid^="teach-chip-"]').evaluate((element) => {
    return getComputedStyle(element).color
  })
  const surfaceColor = await teachNote.evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(chipColor).not.toBe(surfaceColor)
})
