import { expect, test, type Page } from '@playwright/test'
import { installFakeBoardHost } from './install-fake-board-host'
import { buildPlayableBoard, installPlayableOptionRoutes } from './install-playable-option-routes'
import { ensureZonesForUnit } from '../../src/features/review-board/model/ensure-zones-for-unit'
import type { BoardDocument } from '../../src/features/review-board/model/board-document.schema'

interface Diagnostics {
  frames: Array<{ id: string; lifeState: string; zoneId: string | null; x: number; y: number }>
  units: Array<{ id: string; state: string }>
  zones: Array<{ id: string; unitId: string; kind: string; collapsed: boolean }>
  verdicts: Array<{ id: string; frameId: string; kind: string }>
}

async function diagnostics(page: Page): Promise<Diagnostics> {
  return JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '{}') as Diagnostics
}

// Frames sit below the toolbar so the playable drag handle is not covered.
function buildZoneBoard(count: number): BoardDocument {
  const base = buildPlayableBoard(count)
  return ensureZonesForUnit({
    ...base,
    zones: [],
    frames: base.frames.map((frame) => ({ ...frame, y: 120 })),
  }, 'unit-1')
}

async function openBoard(page: Page, count = 2) {
  await installPlayableOptionRoutes(page)
  await installFakeBoardHost(page, buildZoneBoard(count))
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText(`${count} screens`, { timeout: 30_000 })
}

async function dragFrameToZone(page: Page, frameId: string, zoneKind: 'archive' | 'killed') {
  const document = await diagnostics(page)
  const zone = document.zones.find((item) => item.kind === zoneKind)
  expect(zone).toBeTruthy()
  const zoneNode = page.getByTestId(`zone-${zone!.id}`)
  await expect(zoneNode).toBeVisible()

  const handle = page.getByTestId(`drag-handle-${frameId}`)
  const handleBox = await handle.boundingBox()
  const zoneBox = await zoneNode.boundingBox()
  if (!handleBox || !zoneBox) throw new Error('Missing drag handle or zone box')

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(zoneBox.x + zoneBox.width / 2, zoneBox.y + zoneBox.height / 2, { steps: 12 })
  await page.mouse.up()
}

test('reactflow: unit zones render behind options', async ({ page }) => {
  await openBoard(page, 2)
  const document = await diagnostics(page)
  expect(document.zones.map((zone) => zone.kind).sort()).toEqual(['archive', 'killed'])
  for (const zone of document.zones) {
    await expect(page.getByTestId(`zone-${zone.id}`)).toBeVisible()
  }
})

test('reactflow: drag into archive zones the option; drag out restores it', async ({ page }) => {
  await openBoard(page, 2)
  await dragFrameToZone(page, 'p0', 'archive')

  await expect.poll(async () => {
    const frame = (await diagnostics(page)).frames.find((item) => item.id === 'p0')
    return frame?.lifeState
  }).toBe('archived')

  const archived = (await diagnostics(page)).frames.find((item) => item.id === 'p0')
  expect(archived?.zoneId).toBeTruthy()
  await expect(page.getByTestId('frame-p0')).toHaveClass(/is-zoned/)

  // Drag back toward the option row (above the zones).
  const handle = page.getByTestId('drag-handle-p0')
  const handleBox = await handle.boundingBox()
  if (!handleBox) throw new Error('Missing drag handle')
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + handleBox.width / 2, 80, { steps: 12 })
  await page.mouse.up()

  await expect.poll(async () => {
    const frame = (await diagnostics(page)).frames.find((item) => item.id === 'p0')
    return frame?.lifeState
  }).toBe('active')
  expect((await diagnostics(page)).frames.find((item) => item.id === 'p0')?.zoneId ?? null).toBeNull()
})

test('reactflow: drag into killed zone opens confirm; confirm writes a kill verdict', async ({ page }) => {
  await openBoard(page, 2)
  await dragFrameToZone(page, 'p1', 'killed')

  await expect(page.getByTestId('drag-kill-bloom')).toBeVisible()
  await expect(page.getByTestId('verdict-bloom')).toBeVisible()
  // Drop alone must not kill — only confirm does.
  expect((await diagnostics(page)).frames.find((item) => item.id === 'p1')?.lifeState).toBe('active')

  await page.getByTestId('verdict-confirm').click()
  await expect.poll(async () => (await diagnostics(page)).verdicts.length).toBe(1)

  const document = await diagnostics(page)
  expect(document.frames.find((item) => item.id === 'p1')).toMatchObject({ lifeState: 'killed' })
  expect(document.frames.find((item) => item.id === 'p1')?.zoneId).toBeTruthy()
  expect(document.verdicts[0]).toMatchObject({ frameId: 'p1', kind: 'kill' })
})

test('reactflow: canceling a drag-kill leaves the option active', async ({ page }) => {
  await openBoard(page, 2)
  await dragFrameToZone(page, 'p0', 'killed')
  await expect(page.getByTestId('verdict-bloom')).toBeVisible()
  await page.getByTestId('verdict-cancel').click()
  await expect(page.getByTestId('verdict-bloom')).toHaveCount(0)
  expect((await diagnostics(page)).frames.find((item) => item.id === 'p0')?.lifeState).toBe('active')
  expect((await diagnostics(page)).verdicts).toHaveLength(0)
})

test('reactflow: promote places archived siblings in the archive zone', async ({ page }) => {
  await openBoard(page, 3)
  await page.getByTestId('surface-p0').click({ position: { x: 10, y: 10 } })
  await page.getByTestId('frame-verdict-promote').click()
  await page.getByTestId('verdict-confirm').click()

  await expect.poll(async () => (await diagnostics(page)).verdicts.length).toBe(1)
  const document = await diagnostics(page)
  const archive = document.zones.find((zone) => zone.kind === 'archive')
  expect(archive).toBeTruthy()
  expect(document.frames.find((item) => item.id === 'p1')).toMatchObject({
    lifeState: 'archived',
    zoneId: archive!.id,
  })
  expect(document.frames.find((item) => item.id === 'p2')).toMatchObject({
    lifeState: 'archived',
    zoneId: archive!.id,
  })
})

test('reactflow: collapsing a zone hides member frames and shows thumbnails', async ({ page }) => {
  await openBoard(page, 2)
  await dragFrameToZone(page, 'p0', 'archive')
  await expect.poll(async () => {
    return (await diagnostics(page)).frames.find((item) => item.id === 'p0')?.lifeState
  }).toBe('archived')

  const archive = (await diagnostics(page)).zones.find((zone) => zone.kind === 'archive')!
  await page.getByTestId(`zone-collapse-${archive.id}`).click()

  await expect.poll(async () => {
    return (await diagnostics(page)).zones.find((zone) => zone.id === archive.id)?.collapsed
  }).toBe(true)
  await expect(page.getByTestId('frame-p0')).toHaveCount(0)
  await expect(page.getByTestId(`zone-thumbs-${archive.id}`)).toBeVisible()
  await expect(page.locator('[data-testid^="playable-iframe-p0"]')).toHaveCount(0)
})
