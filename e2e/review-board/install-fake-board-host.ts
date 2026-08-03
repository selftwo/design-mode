import type { Page } from '@playwright/test'
import type { BoardDocument } from '../../src/features/review-board/model/board-document.schema'
import { createPressureTestBoard } from '../../src/test-support/create-pressure-test-board'

export type FakeBoardHostOptions = {
  liveFixturePath?: string
  reviewBatchDelivery?: 'succeed' | 'fail'
}

export async function installFakeBoardHost(
  page: Page,
  boardDocument?: BoardDocument,
  options?: FakeBoardHostOptions,
) {
  const board = boardDocument ?? createPressureTestBoard()
  const liveFixturePath = options?.liveFixturePath ?? 'live-review.html'
  const reviewBatchDelivery = options?.reviewBatchDelivery ?? 'succeed'
  await page.addInitScript(({ serializedBoard, liveFixturePath: fixturePath, reviewBatchDelivery: deliveryBehavior }: {
    serializedBoard: BoardDocument
    liveFixturePath: string
    reviewBatchDelivery: 'succeed' | 'fail'
  }) => {
    const liveFixtureOrigin = 'http://127.0.0.1:5199'

    window.addEventListener('message', (event) => {
      if (event.source !== window) return
      const data = event.data
      if (!data || typeof data !== 'object') return

      if (data.type === 'design-review/request-board') {
        window.postMessage({
          type: 'design-review/load-board',
          schemaVersion: 1,
          board: serializedBoard,
        }, window.location.origin)
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
          liveUrl: `${liveFixtureOrigin}/${fixturePath}#${hash}`,
          allowedOrigin: liveFixtureOrigin,
          focusToken,
        }, window.location.origin)
        return
      }

      if (data.type === 'design-review/request-capture-refresh' && data.schemaVersion === 1) {
        const frame = serializedBoard.frames.find((item) => item.id === data.frameId)
        if (!frame) {
          window.postMessage({
            type: 'design-review/capture-refresh-failure',
            schemaVersion: 1,
            requestId: data.requestId,
            frameId: data.frameId,
            error: 'Unknown frame',
          }, window.location.origin)
          return
        }
        const nextRevision = frame.revision + 1
        window.postMessage({
          type: 'design-review/capture-refresh-success',
          schemaVersion: 1,
          requestId: data.requestId,
          frameId: data.frameId,
          screenshotPath: frame.screenshotPath,
          screenshotDataUrl: frame.refreshedScreenshotDataUrl,
          refreshedScreenshotDataUrl: frame.refreshedScreenshotDataUrl,
          captureHash: `${frame.captureHash.replace(/-revision-\d+$/, '')}-revision-${nextRevision}-host`,
        }, window.location.origin)
        return
      }

      if (data.type === 'design-review/deliver-review-batch' && data.schemaVersion === 1) {
        if (deliveryBehavior === 'fail') {
          window.postMessage({
            type: 'design-review/review-batch-delivery-failed',
            schemaVersion: 1,
            requestId: data.requestId,
            error: 'Host could not write the review batch',
          }, window.location.origin)
          return
        }
        window.postMessage({
          type: 'design-review/review-batch-delivered',
          schemaVersion: 1,
          requestId: data.requestId,
        }, window.location.origin)
        return
      }

      if (data.type === 'design-review/ask-teach-question' && data.schemaVersion === 1) {
        window.postMessage({
          type: 'design-review/teach-answer',
          schemaVersion: 1,
          requestId: data.requestId,
          answer: {
            answer: 'The filled button is the only solid-ink block in either card, so Keep carries more visual weight.',
            runId: 'teach-run-e2e',
          },
        }, window.location.origin)
      }
    })

    localStorage.removeItem('design-review-comments-collapsed')
  }, { serializedBoard: board, liveFixturePath, reviewBatchDelivery })
}