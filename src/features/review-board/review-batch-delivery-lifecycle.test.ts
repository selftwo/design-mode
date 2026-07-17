import { describe, expect, it } from 'vitest'
import {
  clearReviewBatchDeliveryTimeoutIfPending,
  shouldApplyReviewBatchDeliveryResult,
} from './review-batch-delivery-lifecycle'

describe('review batch delivery lifecycle', () => {
  it('applies a delivered or failed result only when the request id matches the pending request', () => {
    expect(shouldApplyReviewBatchDeliveryResult('req-1', { status: 'delivered', requestId: 'req-1' })).toBe(true)
    expect(shouldApplyReviewBatchDeliveryResult('req-1', { status: 'failed', requestId: 'req-1', error: 'nope' })).toBe(true)
    expect(shouldApplyReviewBatchDeliveryResult('req-1', { status: 'delivered', requestId: 'req-2' })).toBe(false)
    expect(shouldApplyReviewBatchDeliveryResult(null, { status: 'delivered', requestId: 'req-1' })).toBe(false)
    expect(shouldApplyReviewBatchDeliveryResult('req-1', { status: 'ignored' })).toBe(false)
  })

  it('clears a pending request only when its own timeout fires', () => {
    expect(clearReviewBatchDeliveryTimeoutIfPending('req-1', 'req-1')).toEqual({ pendingRequestId: null, timedOut: true })
    expect(clearReviewBatchDeliveryTimeoutIfPending('req-1', 'req-2')).toEqual({ pendingRequestId: 'req-1', timedOut: false })
    expect(clearReviewBatchDeliveryTimeoutIfPending(null, 'req-1')).toEqual({ pendingRequestId: null, timedOut: false })
  })
})
