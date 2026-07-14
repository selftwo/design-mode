import { describe, expect, it } from 'vitest'
import { readTrustedLiveReviewReady } from './live-review-message-provenance'

const context = {
  allowedOrigin: 'http://127.0.0.1:5199',
  frameId: 'frame-01',
  focusToken: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  iframeWindow: {} as Window,
}

const readyPayload = {
  type: 'design-review/live-ready',
  schemaVersion: 1,
  frameId: 'frame-01',
  token: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
}

describe('readTrustedLiveReviewReady', () => {
  it('accepts a matching ready message', () => {
    expect(readTrustedLiveReviewReady({
      origin: 'http://127.0.0.1:5199',
      source: context.iframeWindow,
      data: readyPayload,
    }, context)).toEqual({ ready: true })
  })

  it('rejects wrong origin, source, schema, frame, and token', () => {
    const wrongOrigin = readTrustedLiveReviewReady({
      origin: 'http://evil.test',
      source: context.iframeWindow,
      data: readyPayload,
    }, context)
    expect(wrongOrigin.ready).toBe(false)
    if (!wrongOrigin.ready) expect(wrongOrigin.reason).toBe('wrong-origin')

    const wrongSource = readTrustedLiveReviewReady({
      origin: 'http://127.0.0.1:5199',
      source: {} as Window,
      data: readyPayload,
    }, context)
    if (!wrongSource.ready) expect(wrongSource.reason).toBe('wrong-source')

    const invalidSchema = readTrustedLiveReviewReady({
      origin: 'http://127.0.0.1:5199',
      source: context.iframeWindow,
      data: { type: 'design-review/live-ready', schemaVersion: 2, frameId: 'frame-01', token: context.focusToken },
    }, context)
    if (!invalidSchema.ready) expect(invalidSchema.reason).toBe('invalid-schema')

    const wrongFrame = readTrustedLiveReviewReady({
      origin: 'http://127.0.0.1:5199',
      source: context.iframeWindow,
      data: { ...readyPayload, frameId: 'frame-02' },
    }, context)
    if (!wrongFrame.ready) expect(wrongFrame.reason).toBe('wrong-frame')

    const wrongToken = readTrustedLiveReviewReady({
      origin: 'http://127.0.0.1:5199',
      source: context.iframeWindow,
      data: { ...readyPayload, token: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    }, context)
    if (!wrongToken.ready) expect(wrongToken.reason).toBe('wrong-token')
  })
})