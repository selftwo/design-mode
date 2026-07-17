import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardHost } from './host/window-board-host'
import {
  acceptLiveSessionResult,
  claimLiveFocusToken,
  clearHostRequestTimeoutIfPending,
  createLiveFocusTokenHistory,
  HOST_LIVE_SESSION_TIMEOUT_ERROR,
  HOST_LIVE_SESSION_TIMEOUT_MS,
  type PendingHostRequest,
} from './live-frame-session-lifecycle'

export interface LiveFrameSession {
  frameId: string
  requestId: string
  liveUrl: string
  allowedOrigin: string
  focusToken: string
}

export function useLiveFrameSession(host: BoardHost) {
  const [session, setSession] = useState<LiveFrameSession | null>(null)
  const [pendingFrameId, setPendingFrameId] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const pendingRequestRef = useRef<PendingHostRequest | null>(null)
  const sessionTimeoutRef = useRef<number | null>(null)
  const focusTokenHistoryRef = useRef(createLiveFocusTokenHistory())

  const clearSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current !== null) {
      window.clearTimeout(sessionTimeoutRef.current)
      sessionTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return host.subscribeLiveSession((result) => {
      if (!acceptLiveSessionResult(pendingRequestRef.current, result)) return
      clearSessionTimeout()
      if (result.status === 'rejected') {
        pendingRequestRef.current = null
        setPendingFrameId(null)
        setSessionError(result.error)
        return
      }
      const reuseError = claimLiveFocusToken(focusTokenHistoryRef.current, result.focusToken)
      if (reuseError) {
        pendingRequestRef.current = null
        setPendingFrameId(null)
        setSessionError(reuseError)
        return
      }
      pendingRequestRef.current = null
      setPendingFrameId(null)
      setSessionError(null)
      setSession({
        frameId: result.frameId,
        requestId: result.requestId,
        liveUrl: result.liveUrl,
        allowedOrigin: result.allowedOrigin,
        focusToken: result.focusToken,
      })
    })
  }, [host, clearSessionTimeout])

  const beginLiveSession = useCallback((frameId: string) => {
    const requestId = crypto.randomUUID()
    clearSessionTimeout()
    pendingRequestRef.current = { requestId, frameId }
    setPendingFrameId(frameId)
    setSessionError(null)
    setSession(null)
    host.requestLiveSession(frameId, requestId)
    sessionTimeoutRef.current = window.setTimeout(() => {
      const outcome = clearHostRequestTimeoutIfPending(pendingRequestRef.current, requestId)
      pendingRequestRef.current = outcome.pending
      if (!outcome.timedOut) return
      clearSessionTimeout()
      setPendingFrameId(null)
      setSessionError(HOST_LIVE_SESSION_TIMEOUT_ERROR)
    }, HOST_LIVE_SESSION_TIMEOUT_MS)
  }, [host, clearSessionTimeout])

  const clearLiveSession = useCallback(() => {
    clearSessionTimeout()
    pendingRequestRef.current = null
    setPendingFrameId(null)
    setSession(null)
    setSessionError(null)
  }, [clearSessionTimeout])

  const clearSessionError = useCallback(() => setSessionError(null), [])

  useEffect(() => () => clearSessionTimeout(), [clearSessionTimeout])

  return {
    session,
    pendingFrameId,
    sessionError,
    beginLiveSession,
    clearLiveSession,
    clearSessionError,
  }
}