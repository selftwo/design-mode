import { z } from 'zod'

export const LIVE_REVIEW_MESSAGE_VERSION = 1 as const

export const LiveReviewHelloMessageSchema = z.object({
  type: z.literal('design-review/live-hello'),
  schemaVersion: z.literal(LIVE_REVIEW_MESSAGE_VERSION),
  frameId: z.string().min(1),
  token: z.string().uuid(),
})

export const LiveReviewReadyMessageSchema = z.object({
  type: z.literal('design-review/live-ready'),
  schemaVersion: z.literal(LIVE_REVIEW_MESSAGE_VERSION),
  frameId: z.string().min(1),
  token: z.string().uuid(),
})

export const LiveReviewMessageSchema = z.discriminatedUnion('type', [
  LiveReviewHelloMessageSchema,
  LiveReviewReadyMessageSchema,
])

export type LiveReviewHelloMessage = z.infer<typeof LiveReviewHelloMessageSchema>
export type LiveReviewReadyMessage = z.infer<typeof LiveReviewReadyMessageSchema>
export type LiveReviewMessage = z.infer<typeof LiveReviewMessageSchema>