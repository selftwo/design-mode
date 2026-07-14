import { describe, expect, it } from 'vitest'
import {
  HostCaptureRefreshSuccessSchema,
  HostLiveSessionSchema,
  readHostCaptureRefreshMessage,
  readHostLiveSessionMessage,
} from './host-live-message.schema'

describe('host live message readers', () => {
  it('accepts a valid live session payload', () => {
    const payload = HostLiveSessionSchema.parse({
      type: 'design-review/live-session',
      schemaVersion: 1,
      requestId: '11111111-1111-4111-8111-111111111111',
      frameId: 'frame-01',
      liveUrl: 'http://127.0.0.1:5199/live-review.html',
      allowedOrigin: 'http://127.0.0.1:5199',
      focusToken: '22222222-2222-4222-8222-222222222222',
    })
    expect(readHostLiveSessionMessage(payload)).toEqual({
      status: 'ready',
      requestId: payload.requestId,
      frameId: 'frame-01',
      liveUrl: payload.liveUrl,
      allowedOrigin: payload.allowedOrigin,
      focusToken: payload.focusToken,
    })
  })

  it('ignores live session payloads with non-origin allowedOrigin', () => {
    expect(readHostLiveSessionMessage({
      type: 'design-review/live-session',
      schemaVersion: 1,
      requestId: '11111111-1111-4111-8111-111111111111',
      frameId: 'frame-01',
      liveUrl: 'http://127.0.0.1:5199/live-review.html',
      allowedOrigin: 'http://127.0.0.1:5199/live-review.html',
      focusToken: '22222222-2222-4222-8222-222222222222',
    })).toEqual({ status: 'ignored' })
  })

  it('ignores malformed live session and refresh messages', () => {
    expect(readHostLiveSessionMessage({ type: 'design-review/live-session', schemaVersion: 2 })).toEqual({
      status: 'ignored',
    })
    expect(readHostCaptureRefreshMessage({ type: 'design-review/capture-refresh-success' })).toEqual({
      status: 'ignored',
    })
  })

  it('reads capture refresh failure', () => {
    expect(readHostCaptureRefreshMessage({
      type: 'design-review/capture-refresh-failure',
      schemaVersion: 1,
      requestId: '33333333-3333-4333-8333-333333333333',
      frameId: 'frame-01',
      error: 'Capture service unavailable',
    })).toEqual({
      status: 'failed',
      requestId: '33333333-3333-4333-8333-333333333333',
      frameId: 'frame-01',
      error: 'Capture service unavailable',
    })
  })

  it('reads capture refresh success', () => {
    const payload = HostCaptureRefreshSuccessSchema.parse({
      type: 'design-review/capture-refresh-success',
      schemaVersion: 1,
      requestId: '44444444-4444-4444-8444-444444444444',
      frameId: 'frame-01',
      screenshotPath: 'screens/frame-01.svg',
      screenshotDataUrl: 'data:image/svg+xml;base64,abc',
      refreshedScreenshotDataUrl: 'data:image/svg+xml;base64,def',
      captureHash: 'hash-2',
    })
    expect(readHostCaptureRefreshMessage(payload)).toMatchObject({
      status: 'refreshed',
      frameId: 'frame-01',
      captureHash: 'hash-2',
    })
  })
})