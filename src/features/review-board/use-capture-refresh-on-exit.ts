import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardDocument } from './model/board-document.schema'
import { applyHostCaptureRefresh } from './model/apply-host-capture-refresh'
import type { BoardHost } from './host/window-board-host'
import {
  buildCaptureRefreshPendingIdentity,
  CAPTURE_REFRESH_TIMEOUT_ERROR,
  CAPTURE_REFRESH_TIMEOUT_MS,
  clearHostRequestTimeoutIfPending,
  shouldApplyCaptureRefreshFailure,
  shouldApplyCaptureRefreshSuccess,
  type CaptureRefreshPendingIdentity,
} from './capture-refresh-lifecycle'

function clearRefreshTimeout(ref: { current: number | null }) {
  if (ref.current !== null) {
    window.clearTimeout(ref.current)
    ref.current = null
  }
}

function finishRefresh(
  pendingRef: { current: CaptureRefreshPendingIdentity | null },
  timeoutRef: { current: number | null },
  setRefreshing: (value: boolean) => void,
  setRefreshingFrameId: (value: string | null) => void,
) {
  pendingRef.current = null
  clearRefreshTimeout(timeoutRef)
  setRefreshing(false)
  setRefreshingFrameId(null)
}

export function useCaptureRefreshOnExit(
  host: BoardHost,
  onDocumentChange: (update: BoardDocument | ((current: BoardDocument) => BoardDocument)) => void,
) {
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshingFrameId, setRefreshingFrameId] = useState<string | null>(null)
  const pendingRefreshRef = useRef<CaptureRefreshPendingIdentity | null>(null)
  const refreshTimeoutRef = useRef<number | null>(null)
  const documentRef = useRef<BoardDocument | null>(null)

  const cancelPendingRefresh = useCallback(() => {
    finishRefresh(pendingRefreshRef, refreshTimeoutRef, setRefreshing, setRefreshingFrameId)
  }, [])

  useEffect(() => {
    return host.subscribeCaptureRefresh((result) => {
      const pending = pendingRefreshRef.current
      if (result.status === 'refreshed') {
        if (!pending || pending.requestId !== result.requestId || pending.frameId !== result.frameId) return
        const document = documentRef.current
        if (!document || !shouldApplyCaptureRefreshSuccess(document, pending, result)) {
          finishRefresh(pendingRefreshRef, refreshTimeoutRef, setRefreshing, setRefreshingFrameId)
          return
        }
        let applyError: string | null = null
        onDocumentChange((current) => {
          const applied = applyHostCaptureRefresh(current, result)
          if ('error' in applied) {
            applyError = applied.error
            return current
          }
          return applied
        })
        finishRefresh(pendingRefreshRef, refreshTimeoutRef, setRefreshing, setRefreshingFrameId)
        setRefreshError(applyError)
        return
      }
      if (!shouldApplyCaptureRefreshFailure(pending, result)) return
      finishRefresh(pendingRefreshRef, refreshTimeoutRef, setRefreshing, setRefreshingFrameId)
      setRefreshError(result.error)
    })
  }, [host, onDocumentChange])

  const requestExitRefresh = useCallback((document: BoardDocument, frameId: string) => {
    const requestId = crypto.randomUUID()
    const identity = buildCaptureRefreshPendingIdentity(document, frameId, requestId)
    if ('error' in identity) {
      setRefreshError(identity.error)
      return
    }
    cancelPendingRefresh()
    documentRef.current = document
    pendingRefreshRef.current = identity
    setRefreshError(null)
    setRefreshing(true)
    setRefreshingFrameId(frameId)
    host.requestCaptureRefresh(frameId, requestId)
    refreshTimeoutRef.current = window.setTimeout(() => {
      const outcome = clearHostRequestTimeoutIfPending(pendingRefreshRef.current, requestId)
      pendingRefreshRef.current = outcome.pending
      if (!outcome.timedOut) return
      clearRefreshTimeout(refreshTimeoutRef)
      setRefreshing(false)
      setRefreshingFrameId(null)
      setRefreshError(CAPTURE_REFRESH_TIMEOUT_ERROR)
    }, CAPTURE_REFRESH_TIMEOUT_MS)
  }, [cancelPendingRefresh, host])

  const bindDocument = useCallback((document: BoardDocument | null) => {
    documentRef.current = document
  }, [])

  useEffect(() => () => {
    cancelPendingRefresh()
  }, [cancelPendingRefresh])

  return {
    refreshError,
    refreshing,
    refreshingFrameId,
    requestExitRefresh,
    cancelPendingRefresh,
    bindDocument,
    clearRefreshError: () => setRefreshError(null),
  }
}