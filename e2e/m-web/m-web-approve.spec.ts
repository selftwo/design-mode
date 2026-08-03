import { expect, test } from '@playwright/test'
import { installFakeBoardHost } from '../review-board/install-fake-board-host'
import { installFakeMWebHost } from './install-fake-m-web-host'
import {
  createMWebApproveTestBoard,
  createMWebApproveTestRun,
  createMWebTeachApproveTestBoard,
} from '../../src/test-support/create-m-web-approve-test-board'

const MWEB_VIEWPORT = { width: 390, height: 844 }

test.describe('m-web approve', () => {
  test.use({ viewport: MWEB_VIEWPORT })

  test('approve on m-web resolves the thread on desktop', async ({ page }) => {
    const board = createMWebApproveTestBoard()
    const annotationId = board.annotations[0]!.id
    const host = await installFakeMWebHost(page, board, {
      runs: [createMWebApproveTestRun(annotationId)],
    })

    await page.goto('/m-web.html#/boards')
    await page.getByTestId('mweb-board-smalltools').click()
    await page.getByLabel('Annotation 1 on Home').click()
    await expect(page.getByTestId('mweb-approve-submit')).toBeEnabled()
    await page.getByTestId('mweb-approve-submit').click()
    await expect(page.getByTestId('thread-annotation-hero')).toContainText('✓ resolved')
    await expect(page.getByTestId('mweb-approve-submit')).toBeDisabled()

    const saved = host.getBoard()
    expect(saved.annotations[0]?.resolvedAt).toBeTruthy()

    await page.unroute('**/api/**')
    await installFakeBoardHost(page, saved)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await expect(page.getByTestId('reactflow-canvas')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('open-comment-annotation-hero').click()
    await expect(page.getByTestId('resolve-annotation')).toHaveCount(0)
    await expect(page.getByTestId(`bloom-${annotationId}`)).toContainText('✓ resolved')
  })

  test('teach approve on m-web shows resolved on desktop teach note', async ({ page }) => {
    const board = createMWebTeachApproveTestBoard()
    const host = await installFakeMWebHost(page, board)

    await page.goto('/m-web.html#/projects/smalltools/runs')
    await page.getByTestId('mweb-teach-approve-teach-hero').click()
    await expect(page.getByText('✓ resolved')).toBeVisible()
    expect(host.getBoard().annotations.find((item) => item.id === 'teach-hero')?.resolvedAt).toBeTruthy()

    await page.unroute('**/api/**')
    await installFakeBoardHost(page, host.getBoard())
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await expect(page.getByTestId('reactflow-canvas')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('teach-note-teach-hero').click()
    await expect(page.getByTestId('resolve-teach-teach-hero')).toHaveCount(0)
    await expect(page.getByTestId('teach-note-teach-hero')).toContainText('✓ resolved')
  })

  test('authoring endpoints stay unreachable from m-web', async ({ page }) => {
    await installFakeMWebHost(page)
    await page.goto('/m-web.html#/boards')

    const dispatch = await page.request.post('/api/projects/smalltools/dispatch', {
      data: { agent: 'claude', batch: { schemaVersion: 1, annotations: [] } },
    })
    expect(dispatch.status()).toBe(404)

    const teach = await page.request.post('/api/projects/smalltools/teach', {
      data: { question: 'noop', frameId: 'f', elementId: 'e' },
    })
    expect(teach.status()).toBe(404)

    await expect(page.getByTestId('tool-comment')).toHaveCount(0)
    await expect(page.getByTestId('tool-circle')).toHaveCount(0)
    await expect(page.getByTestId('tool-learn')).toHaveCount(0)
  })
})
