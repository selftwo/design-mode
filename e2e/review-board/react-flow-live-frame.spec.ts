import { expect, test } from '@playwright/test'
import { createPressureTestBoard } from '../../src/test-support/create-pressure-test-board'
import { installFakeBoardHost } from './install-fake-board-host'

test('reactflow: live unavailable when iframe never becomes ready', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text())
  })

  await installFakeBoardHost(page, undefined, { liveFixturePath: 'live-review-delayed-ready.html' })
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText('50 screens', { timeout: 30_000 })

  const helloCountPromise = page.waitForFunction(() => {
    return (window as unknown as { __liveHelloCount?: number }).__liveHelloCount !== undefined
      && (window as unknown as { __liveHelloCount: number }).__liveHelloCount >= 2
  }, undefined, { timeout: 15_000 })

  await page.evaluate(() => {
    window.addEventListener('message', (event) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data.type !== 'design-review/test-live-hello-count') return
      ;(window as unknown as { __liveHelloCount?: number }).__liveHelloCount = data.count
    })
  })

  await page.getByTestId('surface-frame-01').click({ position: { x: 14, y: 14 } })
  await page.getByTestId('focus-selected').click()
  await expect(page.getByTestId('focus-state')).toContainText('frame-01', { timeout: 15_000 })
  await helloCountPromise
  await expect(page.getByTestId('live-state-frame-01')).toHaveText('Live unavailable', { timeout: 15_000 })
  await page.waitForTimeout(2_500)
  await expect(page.getByTestId('live-state-frame-01')).toHaveText('Live unavailable', { timeout: 5_000 })
  expect(pageErrors).toEqual([])
})

test('reactflow: capture refresh failure keeps the current capture', async ({ page }) => {
  const board = createPressureTestBoard()
  await page.addInitScript((serializedBoard: typeof board) => {
    const liveFixtureOrigin = 'http://127.0.0.1:5199'
    window.addEventListener('message', (event) => {
      if (event.source !== window) return
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'design-review/request-board') {
        window.postMessage({ type: 'design-review/load-board', schemaVersion: 1, board: serializedBoard }, window.location.origin)
        return
      }
      if (data.type === 'design-review/request-live-session' && data.schemaVersion === 1) {
        const focusToken = crypto.randomUUID()
        const hash = new URLSearchParams({ frameId: data.frameId, token: focusToken }).toString()
        window.postMessage({
          type: 'design-review/live-session',
          schemaVersion: 1,
          requestId: data.requestId,
          frameId: data.frameId,
          liveUrl: `${liveFixtureOrigin}/live-review.html#${hash}`,
          allowedOrigin: liveFixtureOrigin,
          focusToken,
        }, window.location.origin)
        return
      }
      if (data.type === 'design-review/request-capture-refresh') {
        window.postMessage({
          type: 'design-review/capture-refresh-failure',
          schemaVersion: 1,
          requestId: data.requestId,
          frameId: data.frameId,
          error: 'Capture service unavailable',
        }, window.location.origin)
      }
    })
  }, board)

  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText('50 screens', { timeout: 30_000 })
  const before = JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '')
  const frameBefore = before.frames.find((item: { id: string }) => item.id === 'frame-01')

  await page.getByTestId('surface-frame-01').click({ position: { x: 14, y: 14 } })
  await page.getByTestId('focus-selected').click()
  await expect(page.getByTestId('focus-state')).toHaveText('live frame-01', { timeout: 15_000 })
  await expect(page.getByTestId('live-state-frame-01')).toHaveText('Live ready', { timeout: 15_000 })
  await page.getByTestId('exit-focus').click()
  await expect(page.getByTestId('capture-refresh-error')).toContainText('Capture service unavailable')
  const after = JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '')
  const frameAfter = after.frames.find((item: { id: string }) => item.id === 'frame-01')
  expect(frameAfter.revision).toBe(frameBefore.revision)
  expect(frameAfter.captureHash).toBe(frameBefore.captureHash)
})