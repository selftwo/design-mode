import { expect, test } from '@playwright/test'
import { installFakeBoardHost } from '../review-board/install-fake-board-host'
import { installFakeMWebHost } from './install-fake-m-web-host'
import { createMWebTestBoard } from '../../src/test-support/create-m-web-test-board'

const MWEB_VIEWPORT = { width: 390, height: 844 }

test.describe('m-web companion', () => {
  test.use({ viewport: MWEB_VIEWPORT })

  test('boards → capture → reply lands on the desktop bloom', async ({ page }) => {
    const host = await installFakeMWebHost(page, createMWebTestBoard())
    await page.goto('/m-web.html#/boards')
    await expect(page.getByTestId('mweb-boards-page')).toBeVisible()
    await expect(page.getByTestId('mweb-board-smalltools')).toBeVisible()

    await page.getByTestId('mweb-board-smalltools').click()
    await expect(page.getByTestId('mweb-capture-page')).toBeVisible()
    await page.getByLabel('Annotation 1 on Home').click()
    await expect(page.getByTestId('mweb-thread-sheet')).toHaveAttribute('data-open', 'true')

    await page.getByTestId('mweb-reply-input').fill('Tighter measure from mobile.')
    await page.getByTestId('mweb-reply-submit').click()
    await expect(page.getByText('Tighter measure from mobile.')).toBeVisible()

    const saved = host.getBoard()
    expect(saved.annotations[0] && 'replies' in saved.annotations[0] && saved.annotations[0].replies).toHaveLength(1)

    await page.unroute('**/api/**')
    await installFakeBoardHost(page, saved)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await expect(page.getByTestId('reactflow-canvas')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('open-comment-annotation-hero').click()
    await expect(page.getByText('Tighter measure from mobile.')).toBeVisible()
  })

  test('m-web route does not load the canvas engine', async ({ page }) => {
    await installFakeMWebHost(page)
    await page.goto('/m-web.html#/boards')
    await expect(page.getByTestId('mweb-app')).toBeVisible()
    await expect(page.getByTestId('reactflow-canvas')).toHaveCount(0)
    await expect(page.getByTestId('tool-comment')).toHaveCount(0)

    const urls = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
    const leaked = urls.filter((url) => /@xyflow|react-flow|ReactFlowReviewBoard/i.test(url))
    expect(leaked).toEqual([])
  })

  test('runs and notices surfaces render at the m-web width', async ({ page }) => {
    await installFakeMWebHost(page)
    await page.goto('/m-web.html#/projects/smalltools/runs')
    await expect(page.getByTestId('mweb-runs-page')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()

    await page.goto('/m-web.html#/notices')
    await expect(page.getByTestId('mweb-notices-page')).toBeVisible()
    await expect(page.getByText('Reply not sent. The agent host is unreachable.')).toBeVisible()
  })
})
