import { expect, test, type Page } from '@playwright/test'
import { installFakeBoardHost, type FakeBoardHostOptions } from './install-fake-board-host'

interface Diagnostics {
  annotations: Array<{ id: string; frameId: string; instruction: string }>
}

async function board(page: Page): Promise<Diagnostics> {
  return JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '') as Diagnostics
}

async function framePoint(
  page: Page,
  frameId: string,
  normalized: readonly [number, number],
): Promise<{ x: number; y: number }> {
  const rect = await page.getByTestId(`surface-${frameId}`).boundingBox()
  if (!rect) throw new Error(`No rendered surface for ${frameId}`)
  return { x: rect.x + rect.width * normalized[0], y: rect.y + rect.height * normalized[1] }
}

async function openBoard(page: Page, options?: FakeBoardHostOptions) {
  await installFakeBoardHost(page, undefined, options)
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText('50 screens', { timeout: 30_000 })
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible()
}

async function createComment(page: Page, frameId: string, at: readonly [number, number]) {
  await page.getByTestId('tool-comment').click()
  const point = await framePoint(page, frameId, at)
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.up()
  await expect(page.getByTestId('instruction-input')).toBeFocused()
  return (await board(page)).annotations.at(-1)!
}

test('reactflow: exporting a validated batch delivers every complete draft through the host', async ({ page }) => {
  await openBoard(page)
  // frame-01 is fully visible left of the comments panel; keep clear of its fixture pin.
  const comment = await createComment(page, 'frame-01', [0.3, 0.55])
  await page.getByTestId('instruction-input').fill('Confirm the button label matches the design spec')
  await page.getByTestId('tool-select').click()

  await page.getByTestId('export-annotation').click()
  await expect(page.getByTestId('export-status')).toHaveText('Delivered')
  await expect(page.getByTestId('export-validation-error')).toHaveCount(0)
  await expect(page.getByTestId('export-delivery-error')).toHaveCount(0)

  const batch = JSON.parse(await page.getByTestId('export-output').textContent() ?? '') as {
    schemaVersion: number
    boardId: string
    exportedAt: string
    annotations: Array<{ id: string; frameId: string; instruction: string; route: string }>
  }
  expect(batch.schemaVersion).toBe(1)
  expect(batch.boardId).toBe('canvas-pressure-test')
  expect(typeof batch.exportedAt).toBe('string')
  const record = batch.annotations.find((item) => item.id === comment.id)
  expect(record).toMatchObject({
    frameId: 'frame-01',
    route: '/fixture/1',
    instruction: 'Confirm the button label matches the design spec',
  })
  const serialized = JSON.stringify(batch).toLowerCase()
  for (const banned of ['claude', 'codex', 'cmux', 'opencode', 'vendor']) {
    expect(serialized).not.toContain(banned)
  }
})

test('reactflow: an empty draft instruction blocks export and is identified in the visible error', async ({ page }) => {
  await openBoard(page)
  const comment = await createComment(page, 'frame-01', [0.35, 0.45])
  await page.getByTestId('tool-select').click()

  await page.getByTestId('export-annotation').click()
  await expect(page.getByTestId('export-validation-error')).toContainText(comment.id)
  await expect(page.getByTestId('export-status')).toHaveCount(0)
  await expect(page.getByTestId('export-output')).toHaveText('')
})

test('reactflow: a host delivery failure is shown and does not claim success', async ({ page }) => {
  await openBoard(page, { reviewBatchDelivery: 'fail' })
  await createComment(page, 'frame-01', [0.4, 0.4])
  await page.getByTestId('instruction-input').fill('Verify the empty state illustration renders')
  await page.getByTestId('tool-select').click()

  await page.getByTestId('export-annotation').click()
  await expect(page.getByTestId('export-delivery-error')).toContainText('Host could not write the review batch')
  await expect(page.getByTestId('export-status')).toHaveCount(0)
})
