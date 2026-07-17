import type { HostReviewBatchDeliveryResult } from './host/host-review-batch-message.schema'

export const REVIEW_BATCH_DELIVERY_TIMEOUT_MS = 15_000
export const REVIEW_BATCH_DELIVERY_TIMEOUT_ERROR = 'Review batch delivery timed out'

export function shouldApplyReviewBatchDeliveryResult(
  pendingRequestId: string | null,
  result: HostReviewBatchDeliveryResult,
): result is Extract<HostReviewBatchDeliveryResult, { status: 'delivered' | 'failed' }> {
  if (result.status === 'ignored') return false
  if (pendingRequestId === null) return false
  return pendingRequestId === result.requestId
}

export function clearReviewBatchDeliveryTimeoutIfPending(
  pendingRequestId: string | null,
  requestId: string,
): { pendingRequestId: string | null; timedOut: boolean } {
  if (pendingRequestId !== requestId) return { pendingRequestId, timedOut: false }
  return { pendingRequestId: null, timedOut: true }
}
