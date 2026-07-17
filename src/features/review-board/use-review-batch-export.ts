import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardDocument } from './model/board-document.schema'
import { buildReviewBatch, type ReviewBatch, type ReviewBatchBlock } from './model/review-batch'
import type { BoardHost } from './host/window-board-host'
import {
  clearReviewBatchDeliveryTimeoutIfPending,
  REVIEW_BATCH_DELIVERY_TIMEOUT_ERROR,
  REVIEW_BATCH_DELIVERY_TIMEOUT_MS,
  shouldApplyReviewBatchDeliveryResult,
} from './review-batch-delivery-lifecycle'

export type ReviewBatchExportStatus = 'idle' | 'delivering' | 'delivered' | 'blocked' | 'error'

export function useReviewBatchExport(host: BoardHost) {
  const [status, setStatus] = useState<ReviewBatchExportStatus>('idle')
  const [deliveryError, setDeliveryError] = useState<string | null>(null)
  const [blocks, setBlocks] = useState<ReviewBatchBlock[]>([])
  const [lastBatch, setLastBatch] = useState<ReviewBatch | null>(null)
  const pendingRequestIdRef = useRef<string | null>(null)
  // Held back until the host confirms delivery, so lastBatch never shows an undelivered batch.
  const pendingBatchRef = useRef<ReviewBatch | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const clearTimeoutIfSet = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return host.subscribeReviewBatchDelivery((result) => {
      if (!shouldApplyReviewBatchDeliveryResult(pendingRequestIdRef.current, result)) return
      pendingRequestIdRef.current = null
      clearTimeoutIfSet()
      if (result.status === 'delivered') {
        setStatus('delivered')
        setDeliveryError(null)
        setLastBatch(pendingBatchRef.current)
        pendingBatchRef.current = null
        return
      }
      pendingBatchRef.current = null
      setStatus('error')
      setDeliveryError(result.error)
    })
  }, [host, clearTimeoutIfSet])

  const requestExport = useCallback((document: BoardDocument) => {
    const result = buildReviewBatch(document)
    if (!result.ok) {
      clearTimeoutIfSet()
      pendingRequestIdRef.current = null
      pendingBatchRef.current = null
      setStatus('blocked')
      setBlocks(result.blocks)
      setDeliveryError(null)
      setLastBatch(null)
      return
    }
    setBlocks([])
    setLastBatch(null)
    setStatus('delivering')
    setDeliveryError(null)
    const requestId = crypto.randomUUID()
    pendingRequestIdRef.current = requestId
    pendingBatchRef.current = result.batch
    host.deliverReviewBatch(result.batch, requestId)
    timeoutRef.current = window.setTimeout(() => {
      const outcome = clearReviewBatchDeliveryTimeoutIfPending(pendingRequestIdRef.current, requestId)
      pendingRequestIdRef.current = outcome.pendingRequestId
      if (!outcome.timedOut) return
      pendingBatchRef.current = null
      setStatus('error')
      setDeliveryError(REVIEW_BATCH_DELIVERY_TIMEOUT_ERROR)
    }, REVIEW_BATCH_DELIVERY_TIMEOUT_MS)
  }, [host, clearTimeoutIfSet])

  // Copy-all validates the pool without delivering; failures surface as the same blocked state.
  const flagBlocks = useCallback((nextBlocks: ReviewBatchBlock[]) => {
    clearTimeoutIfSet()
    pendingRequestIdRef.current = null
    pendingBatchRef.current = null
    setStatus('blocked')
    setBlocks(nextBlocks)
    setDeliveryError(null)
    setLastBatch(null)
  }, [clearTimeoutIfSet])

  const resetExportState = useCallback(() => {
    clearTimeoutIfSet()
    pendingRequestIdRef.current = null
    pendingBatchRef.current = null
    setStatus('idle')
    setDeliveryError(null)
    setBlocks([])
    setLastBatch(null)
  }, [clearTimeoutIfSet])

  const acknowledgeDelivery = useCallback(() => {
    setStatus((current) => (current === 'delivered' ? 'idle' : current))
  }, [])

  const dismissDeliveryError = useCallback(() => {
    setDeliveryError(null)
    setStatus((current) => (current === 'error' ? 'idle' : current))
  }, [])

  useEffect(() => () => clearTimeoutIfSet(), [clearTimeoutIfSet])

  return {
    status,
    deliveryError,
    blocks,
    lastBatch,
    requestExport,
    flagBlocks,
    resetExportState,
    acknowledgeDelivery,
    dismissDeliveryError,
  }
}
