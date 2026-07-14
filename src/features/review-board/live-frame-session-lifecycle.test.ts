import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  acceptLiveSessionResult,
  claimLiveFocusToken,
  createLiveFocusTokenHistory,
  HOST_LIVE_SESSION_TIMEOUT_ERROR,
  HOST_LIVE_SESSION_TIMEOUT_MS,
  LIVE_FOCUS_TOKEN_REUSE_ERROR,
  clearHostRequestTimeoutIfPending,
} from './live-frame-session-lifecycle'

describe('live frame session lifecycle', () => {
  const pending = {
    requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    frameId: 'frame-01',
  }
  const ready = {
    status: 'ready' as const,
    requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    frameId: 'frame-01',
    liveUrl: 'http://127.0.0.1:5199/live-review.html',
    allowedOrigin: 'http://127.0.0.1:5199',
    focusToken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  }

  it('accepts only matching request id and frame id', () => {
    expect(acceptLiveSessionResult(pending, ready)).toBe(true)
    expect(acceptLiveSessionResult({ ...pending, requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }, ready)).toBe(false)
    expect(acceptLiveSessionResult({ ...pending, frameId: 'frame-02' }, ready)).toBe(false)
    expect(acceptLiveSessionResult(null, ready)).toBe(false)
    expect(acceptLiveSessionResult(pending, { status: 'ignored' })).toBe(false)
  })

  it('tracks accepted tokens across session clears', () => {
    const history = createLiveFocusTokenHistory()
    const token = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    expect(history.hasAccepted(token)).toBe(false)
    history.recordAccepted(token)
    expect(history.hasAccepted(token)).toBe(true)
  })

  it('rejects reused focus tokens and keeps history after session exit', () => {
    const history = createLiveFocusTokenHistory()
    const token = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    expect(claimLiveFocusToken(history, token)).toBeNull()
    expect(claimLiveFocusToken(history, token)).toBe(LIVE_FOCUS_TOKEN_REUSE_ERROR)
    expect(history.hasAccepted(token)).toBe(true)
  })

  it('clears only matching pending request on timeout', () => {
    expect(clearHostRequestTimeoutIfPending(pending, pending.requestId)).toEqual({
      pending: null,
      timedOut: true,
    })
    expect(clearHostRequestTimeoutIfPending(pending, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).toEqual({
      pending,
      timedOut: false,
    })
    expect(clearHostRequestTimeoutIfPending(null, pending.requestId)).toEqual({
      pending: null,
      timedOut: false,
    })
  })

  describe('host live session timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('clears pending host request after timeout window', () => {
      const requestId = pending.requestId
      vi.advanceTimersByTime(HOST_LIVE_SESSION_TIMEOUT_MS)
      const outcome = clearHostRequestTimeoutIfPending(pending, requestId)
      expect(outcome.timedOut).toBe(true)
      expect(outcome.pending).toBeNull()
      expect(HOST_LIVE_SESSION_TIMEOUT_ERROR).toContain('timed out')
    })
  })
})