import { expect, test, type Page } from '@playwright/test'
import type { BoardDocument } from '../../src/features/review-board/model/board-document.schema'
import { BOARD_SCHEMA_VERSION } from '../../src/features/review-board/model/board-document.schema'
import { installFakeBoardHost } from './install-fake-board-host'

interface Diagnostics {
  frames: Array<{ id: string; x: number; y: number }>
  annotations: Array<{ id: string; frameId: string; instruction: string }>
}

function keyboardWorkflowBoard(): BoardDocument {
  const dataUrl = 'data:image/svg+xml;base64,PHN2Zy8+'
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    boardId: 'keyboard-workflow-board',
    camera: { worldX: 99, worldY: -44, zoom: 0.55 },
    frames: [
      {
        id: 'kb-frame-a',
        label: 'Keyboard A',
        route: '/keyboard/a',
        viewport: { width: 800, height: 600 },
        x: 120,
        y: 80,
        width: 320,
        height: 240,
        aspectRatio: 4 / 3,
        screenshotPath: 'screens/kb-a.svg',
        screenshotDataUrl: dataUrl,
        refreshedScreenshotDataUrl: dataUrl,
        captureHash: 'kb-capture-a',
        revision: 1,
        elements: [],
      },
      {
        id: 'kb-frame-b',
        label: 'Keyboard B',
        route: '/keyboard/b',
        viewport: { width: 1280, height: 720 },
        x: 520,
        y: 80,
        width: 360,
        height: 202.5,
        aspectRatio: 16 / 9,
        screenshotPath: 'screens/kb-b.svg',
        screenshotDataUrl: dataUrl,
        refreshedScreenshotDataUrl: dataUrl,
        captureHash: 'kb-capture-b',
        revision: 1,
        elements: [],
      },
    ],
    annotations: [],
  }
}

async function board(page: Page): Promise<Diagnostics> {
  return JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '') as Diagnostics
}

async function activateToolbarButton(page: Page, testId: string) {
  await page.getByTestId(testId).focus()
  await page.keyboard.press('Enter')
}

test('reactflow: completes the review workflow with keyboard input', async ({ page }) => {
  test.setTimeout(60_000)
  await installFakeBoardHost(page, keyboardWorkflowBoard())
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText('2 screens', { timeout: 30_000 })
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible()

  const frameNode = page.locator('[data-testid="rf__node-kb-frame-a"]')
  await expect(frameNode).toBeVisible()

  // Select a frame with the keyboard: Tab lands on it (native tabIndex=0), Enter selects it.
  await frameNode.focus()
  await expect(frameNode).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('selected-frame')).toHaveText('kb-frame-a')

  // Switch to the comment tool with the keyboard and create an annotation on the focused frame.
  await activateToolbarButton(page, 'tool-comment')
  await expect(page.getByTestId('tool-comment')).toHaveAttribute('aria-pressed', 'true')
  await frameNode.focus()
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('annotation-count')).toHaveText('1 annotation')
  await expect(page.getByTestId('instruction-input')).toBeFocused()
  const created = (await board(page)).annotations.at(-1)!
  expect(created.frameId).toBe('kb-frame-a')
  await expect(page.getByTestId('instruction-incomplete')).toBeVisible()

  await page.keyboard.type('Keyboard review: confirm the header spacing')
  await expect(page.getByTestId('instruction-complete')).toBeVisible()

  // Back to the select tool, then deselect the annotation by re-selecting its frame.
  await activateToolbarButton(page, 'tool-select')
  await frameNode.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('selected-annotation')).toHaveText('none selected')

  // Reach the annotation mark purely with the keyboard and re-select it.
  const mark = page.getByTestId(`mark-${created.id}`)
  await mark.focus()
  await expect(mark).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('selected-annotation')).toHaveText(created.id)

  // Delete it with the keyboard.
  await page.getByTestId('delete-annotation').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('annotation-count')).toHaveText('0 annotations')
  await expect(page.getByTestId('selected-annotation')).toHaveText('none selected')

  // Create a fresh, complete annotation to carry through save, live mode, and export.
  await activateToolbarButton(page, 'tool-comment')
  await frameNode.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.type('Keyboard export candidate')
  await activateToolbarButton(page, 'tool-select')

  await expect(page.getByTestId('board-save-status')).toHaveText('Saved')

  // Dirty the board again so reset needs confirmation, then confirm it with the keyboard.
  await frameNode.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await board(page)).frames.find((item) => item.id === 'kb-frame-a')?.x)
    .not.toBe(120)

  await activateToolbarButton(page, 'reset-board')
  await expect(page.getByRole('dialog', { name: 'Reset board?' })).toBeVisible()
  await page.getByTestId('reset-confirm').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('reset-confirm-dialog')).not.toBeVisible()
  await expect(page.getByTestId('annotation-count')).toHaveText('0 annotations')

  // Enter and exit live mode with the keyboard.
  await frameNode.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('selected-frame')).toHaveText('kb-frame-a')
  await activateToolbarButton(page, 'focus-selected')
  await expect(page.getByTestId('focus-state')).toHaveText('live kb-frame-a', { timeout: 15_000 })
  await expect(page.getByTestId('live-state-kb-frame-a')).toHaveText('Live ready', { timeout: 15_000 })
  await activateToolbarButton(page, 'exit-focus')
  await expect(page.getByTestId('focus-state')).toHaveText('screenshot mode')

  // Create one more complete annotation and export the batch, all with the keyboard.
  await activateToolbarButton(page, 'tool-comment')
  await frameNode.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.type('Final keyboard review note')
  await activateToolbarButton(page, 'tool-select')

  await activateToolbarButton(page, 'export-annotation')
  await expect(page.getByTestId('export-status')).toHaveText('Delivered')
  const batch = JSON.parse(await page.getByTestId('export-output').textContent() ?? '') as {
    annotations: Array<{ instruction: string }>
  }
  expect(batch.annotations.some((item) => item.instruction === 'Final keyboard review note')).toBe(true)
})
