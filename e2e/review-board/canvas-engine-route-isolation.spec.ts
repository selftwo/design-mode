import { expect, test } from '@playwright/test'
import { installFakeBoardHost } from './install-fake-board-host'

const OPTIONAL_RESOURCE_PATTERN = /excalidraw|percentages-BXMCSKIN|subset-shared|subset-worker|Assistant-(?:Regular|Medium|SemiBold|Bold)/i

function resourceUrls(page: import('@playwright/test').Page) {
  return page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
}

test('default route loads React Flow without optional Excalidraw resources', async ({ page }) => {
  await installFakeBoardHost(page)
  await page.goto('/')
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('board-status')).toContainText('50 screens')

  const urls = await resourceUrls(page)
  const leaked = urls.filter((url) => OPTIONAL_RESOURCE_PATTERN.test(url))
  expect(leaked).toEqual([])
})

test('explicit reactflow route loads without optional Excalidraw resources', async ({ page }) => {
  await installFakeBoardHost(page)
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible({ timeout: 30_000 })

  const urls = await resourceUrls(page)
  const leaked = urls.filter((url) => OPTIONAL_RESOURCE_PATTERN.test(url))
  expect(leaked).toEqual([])
})

test('explicit excalidraw route loads optional resources and the shared 50-frame board', async ({ page }) => {
  await installFakeBoardHost(page)
  await page.goto('/?engine=excalidraw')
  await expect(page.getByTestId('excalidraw-canvas')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('board-status')).toContainText('50 screens')

  const urls = await resourceUrls(page)
  const optionalHits = urls.filter((url) => OPTIONAL_RESOURCE_PATTERN.test(url))
  expect(optionalHits.length).toBeGreaterThan(0)

  const diagnostics = JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '') as {
    frames: unknown[]
  }
  expect(diagnostics.frames).toHaveLength(50)
})