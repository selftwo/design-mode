import { expect, test, type Page } from '@playwright/test'
import { installFakeBoardHost } from './install-fake-board-host'
import { buildPlayableBoard, installPlayableOptionRoutes } from './install-playable-option-routes'

async function diagnostics(page: Page) {
  return JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '{}') as {
    frames: Array<{ id: string; kitState: Record<string, boolean | string> | null }>
  }
}

test('reactflow: mounts at most the cap of sandboxed iframes and reaches ready over an opaque origin', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await installPlayableOptionRoutes(page)
  await installFakeBoardHost(page, buildPlayableBoard(8))
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText('8 screens', { timeout: 30_000 })

  // At least one option mounts, and the live-iframe count never exceeds the cap.
  await expect.poll(async () => page.locator('[data-testid^="playable-iframe-"]').count()).toBeGreaterThan(0)
  expect(await page.locator('[data-testid^="playable-iframe-"]').count()).toBeLessThanOrEqual(6)

  // The option iframe is sandboxed as allow-scripts, so it runs at an opaque origin.
  await expect(page.locator('[data-testid^="playable-iframe-"]').first()).toHaveAttribute('sandbox', 'allow-scripts')

  // At least one option completes the handshake through the opaque ("null") origin.
  await expect(page.locator('[data-testid^="playable-frame-"][data-ready="true"]').first()).toBeVisible({ timeout: 20_000 })

  expect(pageErrors).toEqual([])
})

test('reactflow: kit changes stay frame-local', async ({ page }) => {
  await installPlayableOptionRoutes(page)
  await installFakeBoardHost(page, buildPlayableBoard(3))
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText('3 screens', { timeout: 30_000 })

  await page.getByTestId('surface-p0').click({ position: { x: 10, y: 10 } })
  await expect(page.getByTestId('frame-kit-island')).toBeVisible()

  await page.getByTestId('kit-p0-expand').check()

  await expect.poll(async () => {
    const document = await diagnostics(page)
    return document.frames.find((frame) => frame.id === 'p0')?.kitState?.expand
  }).toBe(true)

  const document = await diagnostics(page)
  // The edit is frame-local: a sibling option keeps its own state.
  expect(document.frames.find((frame) => frame.id === 'p1')?.kitState?.expand).toBe(false)
})

test('reactflow: review mode draws over the mounted iframe, play mode hands it input', async ({ page }) => {
  await installPlayableOptionRoutes(page)
  await installFakeBoardHost(page, buildPlayableBoard(3))
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText('3 screens', { timeout: 30_000 })

  await page.getByTestId('surface-p0').click({ position: { x: 10, y: 10 } })
  await expect(page.getByTestId('frame-kit-island')).toBeVisible()

  // Selecting a frame forces it into the live set, so its iframe is mounted.
  const iframe = page.getByTestId('playable-iframe-p0')
  await expect(iframe).toBeVisible()
  // Default review mode: the iframe is inert so marks land over it.
  await expect(iframe).toHaveCSS('pointer-events', 'none')

  await page.getByTestId('tool-circle').click()
  const box = await page.getByTestId('surface-p0').boundingBox()
  if (!box) throw new Error('surface-p0 has no bounding box')
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByTestId('annotation-count')).toHaveText('1 annotation', { timeout: 10_000 })

  // Play mode hands pointer input to the still-mounted iframe.
  await page.getByTestId('tool-select').click()
  await page.getByTestId('surface-p0').click({ position: { x: 10, y: 10 } })
  await page.getByTestId('frame-kit-play').click()
  await expect(page.getByTestId('playable-frame-p0')).toHaveAttribute('data-mode', 'play')
  await expect(iframe).toHaveCSS('pointer-events', 'auto')
})
