import { expect, test, type Page } from '@playwright/test'
import type { BoardDocument } from '../../src/features/review-board/model/board-document.schema'
import { BOARD_SCHEMA_VERSION } from '../../src/features/review-board/model/board-document.schema'
import { STORAGE_KEY } from '../../src/features/review-board/model/board-local-storage'

interface Diagnostics {
  camera: { worldX: number; worldY: number; zoom: number }
  frames: Array<{
    id: string
    x: number
    y: number
    width: number
    height: number
    aspectRatio: number
    revision: number
    captureHash: string
  }>
  annotations: Array<{
    id: string
    frameId: string
    instruction: string
    anchor: readonly [number, number]
    mark: null | { points: readonly [readonly [number, number], readonly [number, number]] }
    madeAgainstCaptureHash: string
    madeAgainstRevision: number
  }>
}

function hostBaselineBoard(): BoardDocument {
  const dataUrl = 'data:image/svg+xml;base64,PHN2Zy8+'
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    boardId: 'host-reset-baseline',
    documentRevision: 1,
    camera: { worldX: 99, worldY: -44, zoom: 0.55 },
    frames: [
      {
        id: 'host-frame-a',
        label: 'Host A',
        route: '/host/a',
        viewport: { width: 800, height: 600 },
        x: 120,
        y: 80,
        width: 320,
        height: 240,
        aspectRatio: 4 / 3,
        screenshotPath: 'screens/host-a.svg',
        screenshotDataUrl: dataUrl,
        refreshedScreenshotDataUrl: dataUrl,
        captureHash: 'host-capture-a',
        revision: 1,
        elements: [],
        kind: 'captured-route',
        lifeState: 'active',
      },
      {
        id: 'host-frame-b',
        label: 'Host B',
        route: '/host/b',
        viewport: { width: 1280, height: 720 },
        x: 520,
        y: 80,
        width: 360,
        height: 202.5,
        aspectRatio: 16 / 9,
        screenshotPath: 'screens/host-b.svg',
        screenshotDataUrl: dataUrl,
        refreshedScreenshotDataUrl: dataUrl,
        captureHash: 'host-capture-b',
        revision: 1,
        elements: [],
        kind: 'captured-route',
        lifeState: 'active',
      },
    ],
    annotations: [],
    units: [],
    zones: [],
    verdicts: [],
    reviewSummaries: [],
  }
}

async function installHostBoard(page: Page, boardDocument: BoardDocument) {
  await page.addInitScript((board) => {
    window.addEventListener('message', (event) => {
      if (event.source !== window || event.data?.type !== 'design-review/request-board') return
      window.postMessage({
        type: 'design-review/load-board',
        schemaVersion: 1,
        board,
      }, window.location.origin)
    })
  }, boardDocument)
}

async function board(page: Page): Promise<Diagnostics> {
  return JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '') as Diagnostics
}

async function openReactFlowBoard(page: Page, boardDocument = hostBaselineBoard()) {
  await installHostBoard(page, boardDocument)
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText('2 screens', { timeout: 30_000 })
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible()
}

test('reactflow: save and reload restore semantic board data', async ({ page }) => {
  await openReactFlowBoard(page)
  const baseline = await board(page)

  await page.getByTestId('tool-comment').click()
  const surface = await page.getByTestId('surface-host-frame-a').boundingBox()
  if (!surface) throw new Error('Host frame surface missing')
  await page.mouse.click(surface.x + surface.width * 0.4, surface.y + surface.height * 0.35)

  await page.getByTestId('instruction-input').fill('Persist this note')

  const beforeSave = await board(page)
  expect(beforeSave.annotations.length).toBe(1)
  expect(beforeSave.camera).toEqual(baseline.camera)

  await expect(page.getByTestId('board-save-status')).toHaveText('Saved')

  await page.reload()
  await expect(page.getByTestId('board-status')).toContainText('2 screens', { timeout: 30_000 })

  const afterReload = await board(page)
  expect(afterReload).toEqual(beforeSave)
  expect(afterReload.frames[0]?.captureHash).toBe('host-capture-a')
  expect(afterReload.annotations[0]?.madeAgainstCaptureHash).toBe('host-capture-a')
  expect(afterReload.annotations[0]?.madeAgainstRevision).toBe(1)
})

test('reactflow: failed save shows error and leaves diagnostics unchanged', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === 'design-review-canvas-v2') {
        throw new Error('quota exceeded')
      }
      return original.call(this, key, value)
    }
  })
  await openReactFlowBoard(page)

  const before = await board(page)
  await page.getByTestId('tool-comment').click()
  const surface = await page.getByTestId('surface-host-frame-b').boundingBox()
  if (!surface) throw new Error('Host frame surface missing')
  await page.mouse.click(surface.x + surface.width * 0.5, surface.y + surface.height * 0.5)
  await page.getByTestId('instruction-input').fill('Should not persist')

  const dirty = await board(page)
  expect(dirty.annotations.length).toBe(1)

  await expect(page.getByTestId('board-save-error')).toContainText('quota exceeded')
  await expect(page.getByTestId('board-save-status')).toHaveCount(0)
  expect(await board(page)).toEqual(dirty)

  await page.reload()
  await expect(page.getByTestId('board-status')).toContainText('2 screens', { timeout: 30_000 })
  const afterReload = await board(page)
  expect(afterReload.annotations).toEqual(before.annotations)
  expect(afterReload.camera).toEqual(before.camera)
})

test('reactflow: clean reset skips confirmation and returns to host board', async ({ page }) => {
  await openReactFlowBoard(page)
  const host = await board(page)

  await page.getByTestId('reset-board').click()
  await expect(page.getByTestId('reset-confirm-dialog')).not.toBeVisible()
  expect(await board(page)).toEqual(host)
})

test('reactflow: dirty reset cancel preserves work and confirm restores host board', async ({ page }) => {
  await openReactFlowBoard(page)
  const host = await board(page)

  await page.getByTestId('tool-comment').click()
  const surface = await page.getByTestId('surface-host-frame-a').boundingBox()
  if (!surface) throw new Error('Host frame surface missing')
  await page.mouse.click(surface.x + surface.width * 0.2, surface.y + surface.height * 0.2)
  await page.getByTestId('instruction-input').fill('Keep after cancel')
  const dirty = await board(page)

  await page.getByTestId('reset-board').click()
  await expect(page.getByRole('dialog', { name: 'Reset board?' })).toBeVisible()
  await page.getByTestId('reset-cancel').click()
  await expect(page.getByTestId('reset-confirm-dialog')).not.toBeVisible()
  await expect(page.getByTestId('reset-board')).toBeFocused()
  expect(await board(page)).toEqual(dirty)
  await expect(page.getByTestId('selected-annotation')).not.toHaveText('none selected')

  await page.getByTestId('reset-board').click()
  await page.getByTestId('reset-confirm').click()
  await expect(page.getByTestId('reset-confirm-dialog')).not.toBeVisible()
  const resetBoard = await board(page)
  expect(resetBoard).toEqual(host)
  expect(resetBoard.annotations).toHaveLength(0)
  expect(resetBoard.camera.worldX).toBe(99)
  await expect(page.getByTestId('selected-frame')).toHaveText('none selected')
  await expect(page.getByTestId('selected-annotation')).toHaveText('none selected')
  await expect(page.getByTestId('focus-state')).toHaveText('screenshot mode')

  await page.reload()
  await expect(page.getByTestId('board-status')).toContainText('2 screens', { timeout: 30_000 })
  expect(await board(page)).toEqual(host)

  const storageValue = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
  expect(storageValue).toBeNull()
})

test('reactflow: reset clear failure shows error and preserves dirty board', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.removeItem
    Storage.prototype.removeItem = function removeItem(key: string) {
      if (key === 'design-review-canvas-v1') {
        throw new Error('clear blocked')
      }
      return original.call(this, key)
    }
  })
  await openReactFlowBoard(page)

  await page.getByTestId('tool-comment').click()
  const surface = await page.getByTestId('surface-host-frame-a').boundingBox()
  if (!surface) throw new Error('Host frame surface missing')
  await page.mouse.click(surface.x + surface.width * 0.3, surface.y + surface.height * 0.3)
  await page.getByTestId('instruction-input').fill('Still here after failed reset')
  const dirty = await board(page)

  await page.getByTestId('reset-board').click()
  await page.getByTestId('reset-confirm').click()
  await expect(page.getByTestId('board-reset-error')).toContainText('clear blocked')
  expect(await board(page)).toEqual(dirty)
  await expect(page.getByTestId('selected-annotation')).not.toHaveText('none selected')
})