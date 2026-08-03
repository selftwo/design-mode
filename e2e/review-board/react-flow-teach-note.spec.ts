import { expect, test } from '@playwright/test'
import type { BoardDocument } from '../../src/features/review-board/model/board-document.schema'
import { installFakeBoardHost } from './install-fake-board-host'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

// A board carrying one screen and one agent-authored teach note, the pinned
// answer to a learn request. The requestId is what the canvas matches a live
// answer on; here it just rides through load so the persisted note is faithful.
function teachBoard(): BoardDocument {
  return {
    schemaVersion: 2,
    boardId: 'teach-board',
    documentRevision: 1,
    camera: { worldX: 0, worldY: 0, zoom: 1 },
    frames: [
      {
        id: 'home',
        label: 'Home',
        route: '/',
        viewport: { width: 1440, height: 900 },
        x: 0,
        y: 0,
        width: 420,
        height: 262.5,
        aspectRatio: 1.6,
        screenshotPath: 'screens/home.png',
        screenshotDataUrl: PNG,
        refreshedScreenshotDataUrl: PNG,
        captureHash: 'home-hash',
        revision: 1,
        elements: [],
        kind: 'captured-route',
        lifeState: 'active',
      },
    ],
    annotations: [
      {
        kind: 'review',
        id: 'teach-1',
        frameId: 'home',
        role: 'teach',
        status: 'draft',
        instruction: 'That control is the primary submit button.',
        anchor: [0.4, 0.6],
        mark: null,
        createdAt: '2026-07-22T00:00:00.000Z',
        madeAgainstCaptureHash: 'home-hash',
        madeAgainstRevision: 1,
        runId: 'run-teach',
        canvasEventId: 'teach-1',
        requestId: '2b1c0e1a-0000-4000-8000-000000000000',
      },
    ],
    units: [],
    zones: [],
    verdicts: [],
    reviewSummaries: [],
  }
}

test('reactflow: a pinned teach note opens as an agent-authored bloom on the canvas', async ({ page }) => {
  test.setTimeout(60_000)
  await installFakeBoardHost(page, teachBoard())
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText('1 screen', { timeout: 30_000 })
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible()

  // The teach note appears in the jump list with a teach chip, and no inline
  // editor: agent-authored rows jump to their canvas bloom instead.
  const row = page.getByTestId('open-comment-teach-1')
  await expect(row).toBeVisible()
  await expect(row.locator('.comment-chip.teach')).toHaveText('teach')
  await row.click()

  // The teach bloom opens at the note's anchor, carrying the ⌁ provenance glyph.
  const bloom = page.getByTestId('teach-note-bloom')
  await expect(bloom).toBeVisible()
  await expect(bloom).toContainText('Teach note')
  await expect(bloom).toContainText('That control is the primary submit button.')
  await expect(bloom.locator('.agent-question-bloom-glyph')).toHaveText('⌁')

  await expect(page.getByTestId('annotation-instruction-editor')).toHaveCount(0)

  await page.getByTestId('agent-question-close').click()
  await expect(page.getByTestId('teach-note-bloom')).toHaveCount(0)
})
