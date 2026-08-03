import { expect, test, type Page } from '@playwright/test'
import type { BoardDocument } from '../../src/features/review-board/model/board-document.schema'
import { BOARD_SCHEMA_VERSION } from '../../src/features/review-board/model/board-document.schema'
import { installFakeBoardHost } from './install-fake-board-host'

function learnLensBoard(): BoardDocument {
  const dataUrl = 'data:image/svg+xml;base64,PHN2Zy8+'
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    boardId: 'learn-lens-board',
    camera: { worldX: 0, worldY: -60, zoom: 1 },
    frames: [
      {
        id: 'learn-frame',
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
        captureHash: 'learn-capture',
        revision: 1,
        elements: [
          {
            id: 'learn-el-cta',
            label: 'Keep everything',
            role: 'button',
            bounds: [[0.08, 0.58], [0.38, 0.76]],
          },
          {
            id: 'learn-el-card',
            label: 'plan-keep',
            role: 'group',
            bounds: [[0.58, 0.18], [0.94, 0.88]],
            aspects: {
              layout: { x: 232, y: 54, width: 144, height: 210, rotation: 0 },
              flex: { direction: 'column', gap: '8px', padding: '12px 12px', align: 'start' },
              radius: '6px',
              fills: [{ name: 'card-bg', value: '#ffffff' }],
              border: { width: '1px', color: { name: 'hairline', value: '#e6e6e6' } },
            },
          },
        ],
      },
    ],
    annotations: [],
  }
}

async function elementPoint(page: Page, normalized: readonly [number, number]) {
  const rect = await page.getByTestId('surface-learn-frame').boundingBox()
  if (!rect) throw new Error('Learn frame surface missing')
  return { x: rect.x + rect.width * normalized[0], y: rect.y + rect.height * normalized[1] }
}

async function learnLensPosition(page: Page) {
  const box = await page.getByTestId('learn-lens-island').boundingBox()
  if (!box) throw new Error('Learn lens island missing')
  return { left: box.x, top: box.y }
}

test('reactflow: learn lens updates content in place and holds drag position', async ({ page }) => {
  await installFakeBoardHost(page, learnLensBoard())
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible()

  await page.getByTestId('tool-learn').click()
  await expect(page.getByTestId('learn-lens-island')).toHaveAttribute('data-open', 'true')
  await expect(page.getByTestId('learn-lens-empty')).toBeVisible()

  const head = page.getByTestId('learn-lens-island-head')
  const beforeDrag = await learnLensPosition(page)
  const headBox = await head.boundingBox()
  if (!headBox) throw new Error('Learn lens head missing')
  await page.mouse.move(headBox.x + headBox.width / 2, headBox.y + headBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(headBox.x + headBox.width / 2 + 40, headBox.y + headBox.height / 2 - 120, { steps: 8 })
  await page.mouse.up()
  const afterDrag = await learnLensPosition(page)
  expect(Math.hypot(afterDrag.left - beforeDrag.left, afterDrag.top - beforeDrag.top)).toBeGreaterThan(40)

  const ctaCenter = await elementPoint(page, [0.23, 0.67])
  await page.mouse.click(ctaCenter.x, ctaCenter.y)
  await expect(page.getByTestId('learn-lens-sub')).toHaveText('▢ Keep everything')
  await expect(page.getByTestId('learn-lens-term')).toContainText('signal')

  const cardCenter = await elementPoint(page, [0.76, 0.45])
  await page.mouse.click(cardCenter.x, cardCenter.y)
  await expect(page.getByTestId('learn-lens-sub')).toHaveText('▢ plan-keep')
  await expect(page.getByTestId('learn-lens-term')).toContainText('card')

  const afterSecondPick = await learnLensPosition(page)
  expect(Math.abs(afterSecondPick.left - afterDrag.left)).toBeLessThan(2)
  expect(Math.abs(afterSecondPick.top - afterDrag.top)).toBeLessThan(2)
})

test('reactflow: learn lens closes from toolbar and header', async ({ page }) => {
  await installFakeBoardHost(page, learnLensBoard())
  await page.goto('/?engine=reactflow')
  await page.getByTestId('tool-learn').click()
  await expect(page.getByTestId('learn-lens-island')).toHaveAttribute('data-open', 'true')
  await page.getByTestId('learn-lens-close').click()
  await expect(page.getByTestId('learn-lens-island')).toHaveAttribute('data-open', 'false')
  await page.getByTestId('tool-learn').click()
  await expect(page.getByTestId('learn-lens-island')).toHaveAttribute('data-open', 'true')
})
