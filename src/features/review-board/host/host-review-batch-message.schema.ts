import { z } from 'zod'
import { ReviewBatchSchema } from '../model/review-batch'

export const HOST_REVIEW_BATCH_MESSAGE_VERSION = 1 as const

export const HOST_REVIEW_BATCH_DELIVER_TYPE = 'design-review/deliver-review-batch' as const
export const HOST_REVIEW_BATCH_DELIVERED_TYPE = 'design-review/review-batch-delivered' as const
export const HOST_REVIEW_BATCH_DELIVERY_FAILED_TYPE = 'design-review/review-batch-delivery-failed' as const

export const HostReviewBatchDeliverRequestSchema = z.object({
  type: z.literal(HOST_REVIEW_BATCH_DELIVER_TYPE),
  schemaVersion: z.literal(HOST_REVIEW_BATCH_MESSAGE_VERSION),
  requestId: z.string().uuid(),
  batch: ReviewBatchSchema,
})

export const HostReviewBatchDeliveredSchema = z.object({
  type: z.literal(HOST_REVIEW_BATCH_DELIVERED_TYPE),
  schemaVersion: z.literal(HOST_REVIEW_BATCH_MESSAGE_VERSION),
  requestId: z.string().uuid(),
})

export const HostReviewBatchDeliveryFailedSchema = z.object({
  type: z.literal(HOST_REVIEW_BATCH_DELIVERY_FAILED_TYPE),
  schemaVersion: z.literal(HOST_REVIEW_BATCH_MESSAGE_VERSION),
  requestId: z.string().uuid(),
  error: z.string().min(1),
})

export type HostReviewBatchDeliveryResult =
  | { status: 'delivered'; requestId: string }
  | { status: 'failed'; requestId: string; error: string }
  | { status: 'ignored' }

export function readHostReviewBatchDeliveryMessage(value: unknown): HostReviewBatchDeliveryResult {
  if (!value || typeof value !== 'object' || !('type' in value)) return { status: 'ignored' }
  const type = value.type
  if (type === HOST_REVIEW_BATCH_DELIVERY_FAILED_TYPE) {
    const parsed = HostReviewBatchDeliveryFailedSchema.safeParse(value)
    if (!parsed.success) return { status: 'ignored' }
    return { status: 'failed', requestId: parsed.data.requestId, error: parsed.data.error }
  }
  if (type !== HOST_REVIEW_BATCH_DELIVERED_TYPE) return { status: 'ignored' }
  const parsed = HostReviewBatchDeliveredSchema.safeParse(value)
  if (!parsed.success) return { status: 'ignored' }
  return { status: 'delivered', requestId: parsed.data.requestId }
}
