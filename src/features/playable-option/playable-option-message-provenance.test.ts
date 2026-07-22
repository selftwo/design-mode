import { describe, expect, it } from 'vitest'
import { readTrustedPlayableOptionReady } from './playable-option-message-provenance'

const context = {
  allowedOrigin: 'http://127.0.0.1:5199',
  frameId: 'frame-01',
  token: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  iframeWindow: {},
}

const readyPayload = {
  type: 'design-review/playable-ready',
  schemaVersion: 1,
  frameId: 'frame-01',
  token: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
}

describe('readTrustedPlayableOptionReady', () => {
  it('accepts a matching ready message', () => {
    expect(readTrustedPlayableOptionReady({
      origin: 'http://127.0.0.1:5199',
      source: context.iframeWindow,
      data: readyPayload,
    }, context)).toEqual({ ready: true })
  })

  it('accepts a ready message from a sandboxed opaque-origin frame ("null")', () => {
    // A frame sandboxed as allow-scripts without allow-same-origin posts with
    // origin "null"; the source-window and token checks carry the trust.
    const opaqueContext = { ...context, allowedOrigin: 'null' }
    expect(readTrustedPlayableOptionReady({
      origin: 'null',
      source: opaqueContext.iframeWindow,
      data: readyPayload,
    }, opaqueContext)).toEqual({ ready: true })
  })

  it('rejects wrong origin, source, schema, frame, and token', () => {
    const wrongOrigin = readTrustedPlayableOptionReady({
      origin: 'http://evil.test',
      source: context.iframeWindow,
      data: readyPayload,
    }, context)
    expect(wrongOrigin.ready).toBe(false)
    if (!wrongOrigin.ready) expect(wrongOrigin.reason).toBe('wrong-origin')

    const wrongSource = readTrustedPlayableOptionReady({
      origin: 'http://127.0.0.1:5199',
      source: {},
      data: readyPayload,
    }, context)
    if (!wrongSource.ready) expect(wrongSource.reason).toBe('wrong-source')

    const invalidSchema = readTrustedPlayableOptionReady({
      origin: 'http://127.0.0.1:5199',
      source: context.iframeWindow,
      data: { type: 'design-review/playable-ready', schemaVersion: 2, frameId: 'frame-01', token: context.token },
    }, context)
    if (!invalidSchema.ready) expect(invalidSchema.reason).toBe('invalid-schema')

    const wrongChannel = readTrustedPlayableOptionReady({
      origin: 'http://127.0.0.1:5199',
      source: context.iframeWindow,
      data: { ...readyPayload, type: 'design-review/live-ready' },
    }, context)
    if (!wrongChannel.ready) expect(wrongChannel.reason).toBe('invalid-schema')

    const wrongFrame = readTrustedPlayableOptionReady({
      origin: 'http://127.0.0.1:5199',
      source: context.iframeWindow,
      data: { ...readyPayload, frameId: 'frame-02' },
    }, context)
    if (!wrongFrame.ready) expect(wrongFrame.reason).toBe('wrong-frame')

    const wrongToken = readTrustedPlayableOptionReady({
      origin: 'http://127.0.0.1:5199',
      source: context.iframeWindow,
      data: { ...readyPayload, token: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    }, context)
    if (!wrongToken.ready) expect(wrongToken.reason).toBe('wrong-token')
  })
})
