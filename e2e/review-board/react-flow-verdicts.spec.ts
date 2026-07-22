import { expect, test, type Page } from '@playwright/test'
import { installFakeBoardHost } from './install-fake-board-host'
import { buildPlayableBoard, installPlayableOptionRoutes } from './install-playable-option-routes'

interface Diagnostics {
  frames: Array<{ id: string; lifeState: string }>
  units: Array<{ id: string; state: string; lockedFrameId: string | null; nomineeFrameId: string | null }>
  verdicts: Array<{ id: string; unitId: string; frameId: string; kind: string; summary: string }>
}

async function diagnostics(page: Page): Promise<Diagnostics> {
  return JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '{}') as Diagnostics
}

async function openBoard(page: Page, count: number) {
  await installPlayableOptionRoutes(page)
  await installFakeBoardHost(page, buildPlayableBoard(count))
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText(`${count} screens`, { timeout: 30_000 })
}

test('reactflow: promote locks the unit, archives siblings, and writes a ledger row', async ({ page }) => {
  await openBoard(page, 3)

  await page.getByTestId('surface-p0').click({ position: { x: 10, y: 10 } })
  await expect(page.getByTestId('frame-kit-island')).toBeVisible()

  await page.getByTestId('frame-verdict-promote').click()
  await expect(page.getByTestId('verdict-bloom')).toBeVisible()
  await page.getByTestId('verdict-confirm').click()

  await expect.poll(async () => (await diagnostics(page)).verdicts.length).toBe(1)
  const document = await diagnostics(page)

  const unit = document.units.find((item) => item.id === 'unit-1')
  expect(unit?.state).toBe('locked')
  expect(unit?.lockedFrameId).toBe('p0')

  const life = Object.fromEntries(document.frames.map((frame) => [frame.id, frame.lifeState]))
  expect(life.p0).toBe('locked')
  expect(life.p1).toBe('archived')
  expect(life.p2).toBe('archived')

  expect(document.verdicts[0]).toMatchObject({ unitId: 'unit-1', frameId: 'p0', kind: 'promote' })

  // The decision surfaces in the ledger, and the decided unit no longer offers a verdict.
  await expect(page.getByTestId('decision-ledger-island')).toBeVisible()
  await expect(page.getByTestId(`ledger-row-${document.verdicts[0]!.id}`)).toBeVisible()
  await expect(page.getByTestId('frame-verdict-promote')).toHaveCount(0)
})

test('reactflow: kill strikes one option and leaves the unit open', async ({ page }) => {
  await openBoard(page, 3)

  await page.getByTestId('surface-p1').click({ position: { x: 10, y: 10 } })
  await expect(page.getByTestId('frame-kit-island')).toBeVisible()

  await page.getByTestId('frame-verdict-kill').click()
  await expect(page.getByTestId('verdict-bloom')).toBeVisible()
  await page.getByTestId('verdict-confirm').click()

  await expect.poll(async () => (await diagnostics(page)).verdicts.length).toBe(1)
  const document = await diagnostics(page)

  expect(document.units.find((item) => item.id === 'unit-1')?.state).toBe('open')
  const life = Object.fromEntries(document.frames.map((frame) => [frame.id, frame.lifeState]))
  expect(life.p1).toBe('killed')
  expect(life.p0).toBe('active')
  expect(document.verdicts[0]).toMatchObject({ frameId: 'p1', kind: 'kill' })
})

test('reactflow: a promote on unreviewed options warns but still confirms', async ({ page }) => {
  await openBoard(page, 3)

  await page.getByTestId('surface-p0').click({ position: { x: 10, y: 10 } })
  await page.getByTestId('frame-verdict-promote').click()
  await expect(page.getByTestId('verdict-bloom')).toBeVisible()

  // Nothing was reviewed, so the confirmation surfaces a heads-up without blocking.
  await expect(page.getByTestId('verdict-warning')).toContainText('not reviewed')
  await page.getByTestId('verdict-confirm').click()

  await expect.poll(async () => (await diagnostics(page)).verdicts.length).toBe(1)
})

test('reactflow: canceling a verdict changes nothing', async ({ page }) => {
  await openBoard(page, 3)

  await page.getByTestId('surface-p0').click({ position: { x: 10, y: 10 } })
  await page.getByTestId('frame-verdict-promote').click()
  await expect(page.getByTestId('verdict-bloom')).toBeVisible()
  await page.getByTestId('verdict-cancel').click()

  await expect(page.getByTestId('verdict-bloom')).toHaveCount(0)
  const document = await diagnostics(page)
  expect(document.verdicts).toHaveLength(0)
  expect(document.units.find((item) => item.id === 'unit-1')?.state).toBe('open')
})
