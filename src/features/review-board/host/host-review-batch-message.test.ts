import { describe, expect, it } from 'vitest'
import { createPressureTestBoard } from '@/test-support/create-pressure-test-board'
import { buildReviewBatch } from '../model/review-batch'
import {
  HostReviewBatchDeliverRequestSchema,
  HostReviewBatchDeliveredSchema,
  readHostReviewBatchDeliveryMessage,
} from './host-review-batch-message.schema'

describe('host review batch delivery message readers', () => {
  it('accepts a valid delivered confirmation', () => {
    const payload = HostReviewBatchDeliveredSchema.parse({
      type: 'design-review/review-batch-delivered',
      schemaVersion: 1,
      requestId: '11111111-1111-4111-8111-111111111111',
    })
    expect(readHostReviewBatchDeliveryMessage(payload)).toEqual({
      status: 'delivered',
      requestId: payload.requestId,
    })
  })

  it('reads a delivery failure', () => {
    expect(readHostReviewBatchDeliveryMessage({
      type: 'design-review/review-batch-delivery-failed',
      schemaVersion: 1,
      requestId: '22222222-2222-4222-8222-222222222222',
      error: 'Host could not write the review batch',
    })).toEqual({
      status: 'failed',
      requestId: '22222222-2222-4222-8222-222222222222',
      error: 'Host could not write the review batch',
    })
  })

  it('ignores malformed or unrelated messages', () => {
    expect(readHostReviewBatchDeliveryMessage({ type: 'design-review/review-batch-delivered', schemaVersion: 2 }))
      .toEqual({ status: 'ignored' })
    expect(readHostReviewBatchDeliveryMessage({ type: 'design-review/load-board' })).toEqual({ status: 'ignored' })
    expect(readHostReviewBatchDeliveryMessage(null)).toEqual({ status: 'ignored' })
  })

  it('validates a real review batch inside a deliver request envelope', () => {
    const board = createPressureTestBoard()
    const result = buildReviewBatch(board)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const parsed = HostReviewBatchDeliverRequestSchema.parse({
      type: 'design-review/deliver-review-batch',
      schemaVersion: 1,
      requestId: '33333333-3333-4333-8333-333333333333',
      batch: result.batch,
    })
    expect(parsed.batch).toEqual(result.batch)
  })
})
