import { describe, expect, it, vi } from 'vitest'
import { createPressureTestBoard } from '@/test-support/create-pressure-test-board'
import { buildReviewBatch } from '../model/review-batch'
import { HOST_BOARD_REQUEST_TYPE } from './host-board-message.schema'
import { createWindowBoardHost } from './window-board-host'

function createMockHostWindow(overrides?: {
  parent?: Window
  opener?: Window | null
  origin?: string
}) {
  const origin = overrides?.origin ?? 'http://canvas.test'
  const parent = overrides?.parent ?? ({} as Window)
  const listeners: Array<(event: MessageEvent) => void> = []
  const postMessage = vi.fn()
  const hostWindow = {
    location: { origin } as Location,
    parent,
    opener: overrides?.opener ?? null,
    postMessage,
    addEventListener: (_type: string, handler: (event: MessageEvent) => void) => {
      listeners.push(handler)
    },
    removeEventListener: (_type: string, handler: (event: MessageEvent) => void) => {
      const index = listeners.indexOf(handler)
      if (index >= 0) listeners.splice(index, 1)
    },
  } as unknown as Window
  return { hostWindow, listeners, postMessage }
}

function dispatch(listeners: Array<(event: MessageEvent) => void>, event: MessageEvent) {
  for (const listener of listeners) listener(event)
}

describe('createWindowBoardHost', () => {
  it('loads a board from a trusted same-window fake host', () => {
    const { hostWindow, listeners } = createMockHostWindow()
    Object.assign(hostWindow, { parent: hostWindow })
    const board = createPressureTestBoard()
    const host = createWindowBoardHost(hostWindow)
    const results: unknown[] = []
    host.subscribe((result) => results.push(result))

    dispatch(listeners, {
      source: hostWindow,
      origin: 'http://canvas.test',
      data: { type: 'design-review/load-board', schemaVersion: 1, board },
    } as MessageEvent)

    expect(results).toEqual([{ status: 'loaded', board }])
  })

  it('ignores a valid envelope from an untrusted origin or source', () => {
    const parent = {} as Window
    const { hostWindow, listeners } = createMockHostWindow({ parent })
    const board = createPressureTestBoard()
    const host = createWindowBoardHost(hostWindow)
    const results: unknown[] = []
    host.subscribe((result) => results.push(result))
    const payload = { type: 'design-review/load-board', schemaVersion: 1, board }

    dispatch(listeners, {
      source: {} as Window,
      origin: 'http://canvas.test',
      data: payload,
    } as MessageEvent)

    dispatch(listeners, {
      source: hostWindow,
      origin: 'http://evil.test',
      data: payload,
    } as MessageEvent)

    expect(results).toEqual([])
  })

  it('accepts a parent host only when origin is configured', () => {
    const parent = {} as Window
    const { hostWindow, listeners } = createMockHostWindow({ parent })
    const board = createPressureTestBoard()
    const host = createWindowBoardHost(hostWindow, {
      allowedLoadOrigins: ['http://canvas.test', 'http://host.test'],
    })
    const results: unknown[] = []
    host.subscribe((result) => results.push(result))

    dispatch(listeners, {
      source: parent,
      origin: 'http://host.test',
      data: { type: 'design-review/load-board', schemaVersion: 1, board },
    } as MessageEvent)

    expect(results).toEqual([{ status: 'loaded', board }])
  })

  it('requests a board from a same-origin parent', () => {
    const parent = { postMessage: vi.fn() } as unknown as Window
    const { hostWindow } = createMockHostWindow({ parent })
    createWindowBoardHost(hostWindow).requestBoard()

    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: HOST_BOARD_REQUEST_TYPE, schemaVersion: 1 },
      'http://canvas.test',
    )
  })

  it('posts board requests to explicit host origins instead of wildcard', () => {
    const parent = { postMessage: vi.fn() } as unknown as Window
    const { hostWindow, postMessage } = createMockHostWindow({ parent, opener: null })
    const host = createWindowBoardHost(hostWindow, {
      allowedLoadOrigins: ['http://canvas.test', 'http://host.test'],
    })
    host.requestBoard()

    const request = { type: HOST_BOARD_REQUEST_TYPE, schemaVersion: 1 }
    expect(postMessage).toHaveBeenCalledWith(request, 'http://canvas.test')
    expect(parent.postMessage).toHaveBeenCalledWith(request, 'http://host.test')
    expect(parent.postMessage).not.toHaveBeenCalledWith(request, '*')
  })

  it('delivers live session and capture refresh results from a trusted host', () => {
    const { hostWindow, listeners, postMessage } = createMockHostWindow()
    Object.assign(hostWindow, { parent: hostWindow })
    const host = createWindowBoardHost(hostWindow)
    const liveResults: unknown[] = []
    const refreshResults: unknown[] = []
    host.subscribeLiveSession((result) => liveResults.push(result))
    host.subscribeCaptureRefresh((result) => refreshResults.push(result))

    host.requestLiveSession('frame-01', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    const liveRequest = postMessage.mock.calls.at(-1)?.[0]
    expect(liveRequest).toMatchObject({ type: 'design-review/request-live-session', frameId: 'frame-01' })

    dispatch(listeners, {
      source: hostWindow,
      origin: 'http://canvas.test',
      data: {
        type: 'design-review/live-session',
        schemaVersion: 1,
        requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        frameId: 'frame-01',
        liveUrl: 'http://127.0.0.1:5199/live-review.html',
        allowedOrigin: 'http://127.0.0.1:5199',
        focusToken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
    } as MessageEvent)
    expect(liveResults).toEqual([{
      status: 'ready',
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      frameId: 'frame-01',
      liveUrl: 'http://127.0.0.1:5199/live-review.html',
      allowedOrigin: 'http://127.0.0.1:5199',
      focusToken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }])

    host.requestCaptureRefresh('frame-01', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
    dispatch(listeners, {
      source: hostWindow,
      origin: 'http://canvas.test',
      data: {
        type: 'design-review/capture-refresh-success',
        schemaVersion: 1,
        requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        frameId: 'frame-01',
        screenshotPath: 'screens/frame-01.svg',
        screenshotDataUrl: 'data:1',
        refreshedScreenshotDataUrl: 'data:2',
        captureHash: 'capture-2',
      },
    } as MessageEvent)
    expect(refreshResults).toEqual([{
      status: 'refreshed',
      requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      frameId: 'frame-01',
      screenshotPath: 'screens/frame-01.svg',
      screenshotDataUrl: 'data:1',
      refreshedScreenshotDataUrl: 'data:2',
      captureHash: 'capture-2',
    }])
  })

  it('delivers a review batch and reads back delivery confirmation', () => {
    const { hostWindow, listeners, postMessage } = createMockHostWindow()
    Object.assign(hostWindow, { parent: hostWindow })
    const host = createWindowBoardHost(hostWindow)
    const board = createPressureTestBoard()
    const result = buildReviewBatch(board)
    if (!result.ok) throw new Error('Expected a valid review batch')
    const deliveryResults: unknown[] = []
    host.subscribeReviewBatchDelivery((entry) => deliveryResults.push(entry))

    host.deliverReviewBatch(result.batch, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')
    const deliverRequest = postMessage.mock.calls.at(-1)?.[0]
    expect(deliverRequest).toMatchObject({
      type: 'design-review/deliver-review-batch',
      requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      batch: result.batch,
    })

    dispatch(listeners, {
      source: hostWindow,
      origin: 'http://canvas.test',
      data: {
        type: 'design-review/review-batch-delivered',
        schemaVersion: 1,
        requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      },
    } as MessageEvent)
    expect(deliveryResults).toEqual([{
      status: 'delivered',
      requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    }])
  })

})