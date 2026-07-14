import { z } from 'zod'

export const LiveReviewHelloMessageSchema = z.object({
  type: z.literal('design-review/hello'),
  token: z.string().uuid(),
})

export const LiveReviewReadyMessageSchema = z.object({
  type: z.literal('design-review/ready'),
  token: z.string().uuid(),
})

export const LiveReviewMessageSchema = z.discriminatedUnion('type', [
  LiveReviewHelloMessageSchema,
  LiveReviewReadyMessageSchema,
])

export type LiveReviewHelloMessage = z.infer<typeof LiveReviewHelloMessageSchema>
export type LiveReviewReadyMessage = z.infer<typeof LiveReviewReadyMessageSchema>
export type LiveReviewMessage = z.infer<typeof LiveReviewMessageSchema>
