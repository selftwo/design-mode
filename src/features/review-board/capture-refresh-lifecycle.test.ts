import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createPressureTestBoard } from '@/test-support/create-pressure-test-board'
import {
  acceptCaptureRefreshResult,
  buildCaptureRefreshPendingIdentity,
  CAPTURE_REFRESH_TIMEOUT_ERROR,
  CAPTURE_REFRESH_TIMEOUT_MS,
  captureRefreshIdentityStillMatches,
  clearHostRequestTimeoutIfPending,
  shouldApplyCaptureRefreshFailure,
  shouldApplyCaptureRefreshSuccess,
} from './capture-refresh-lifecycle'

describe('capture refresh lifecycle', () => {
  const document = createPressureTestBoard()
  const frame = document.frames[0]!
  const pending = buildCaptureRefreshPendingIdentity(document, frame.id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  if ('error' in pending) throw new Error(pending.error)

  const refreshed = {
    status: 'refreshed' as const,
    requestId: pending.requestId,
    frameId: frame.id,
    screenshotPath: 'screens/new.svg',
    screenshotDataUrl: 'data:new',
    refreshedScreenshotDataUrl: 'data:refreshed',
    captureHash: 'capture-revision-2',
  }

  it('captures board and frame identity at request time', () => {
    expect(pending.boardId).toBe(document.boardId)
    expect(pending.captureHash).toBe(frame.captureHash)
    expect(pending.revision).toBe(frame.revision)
  })

  it('rejects stale identity after revision or capture hash changes', () => {
    expect(captureRefreshIdentityStillMatches(document, pending)).toBe(true)

    const bumpedRevision = {
      ...document,
      frames: document.frames.map((item) => item.id === frame.id
        ? { ...item, revision: item.revision + 1 }
        : item),
    }
    expect(captureRefreshIdentityStillMatches(bumpedRevision, pending)).toBe(false)

    const newBoardId = { ...document, boardId: 'other-board' }
    expect(captureRefreshIdentityStillMatches(newBoardId, pending)).toBe(false)
  })

  it('accepts only matching refresh request id and frame id', () => {
    const failed = {
      status: 'failed' as const,
      requestId: pending.requestId,
      frameId: frame.id,
      error: 'nope',
    }
    const request = { requestId: pending.requestId, frameId: frame.id }
    expect(acceptCaptureRefreshResult(request, failed)).toBe(true)
    expect(acceptCaptureRefreshResult({ ...request, frameId: 'frame-02' }, failed)).toBe(false)
    expect(acceptCaptureRefreshResult(null, failed)).toBe(false)
  })

  it('applies success only when pending identity still matches', () => {
    expect(shouldApplyCaptureRefreshSuccess(document, pending, refreshed)).toBe(true)
    const staleDoc = {
      ...document,
      frames: document.frames.map((item) => item.id === frame.id
        ? { ...item, revision: item.revision + 1 }
        : item),
    }
    expect(shouldApplyCaptureRefreshSuccess(staleDoc, pending, refreshed)).toBe(false)
    expect(shouldApplyCaptureRefreshSuccess(document, null, refreshed)).toBe(false)
    expect(shouldApplyCaptureRefreshSuccess(document, pending, {
      ...refreshed,
      requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    })).toBe(false)
  })

  it('applies failure only for matching request and frame', () => {
    const failed = {
      status: 'failed' as const,
      requestId: pending.requestId,
      frameId: frame.id,
      error: 'nope',
    }
    expect(shouldApplyCaptureRefreshFailure(pending, failed)).toBe(true)
    expect(shouldApplyCaptureRefreshFailure(pending, { ...failed, frameId: 'frame-02' })).toBe(false)
    expect(shouldApplyCaptureRefreshFailure(null, failed)).toBe(false)
  })

  describe('capture refresh timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('clears pending refresh after timeout window', () => {
      const requestId = pending.requestId
      vi.advanceTimersByTime(CAPTURE_REFRESH_TIMEOUT_MS)
      const outcome = clearHostRequestTimeoutIfPending(pending, requestId)
      expect(outcome.timedOut).toBe(true)
      expect(outcome.pending).toBeNull()
      expect(CAPTURE_REFRESH_TIMEOUT_ERROR).toContain('timed out')
    })

    it('clears only matching pending request on timeout', () => {
      const request = { requestId: pending.requestId, frameId: frame.id }
      expect(clearHostRequestTimeoutIfPending(request, request.requestId)).toEqual({
        pending: null,
        timedOut: true,
      })
      expect(clearHostRequestTimeoutIfPending(request, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).toEqual({
        pending: request,
        timedOut: false,
      })
      expect(clearHostRequestTimeoutIfPending(null, request.requestId)).toEqual({
        pending: null,
        timedOut: false,
      })
    })
  })
})