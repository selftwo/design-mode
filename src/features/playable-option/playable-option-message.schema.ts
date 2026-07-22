import { z } from 'zod'

// The playable-option iframe handshake. This is the same shape as the
// live-review handshake (src/features/live-review/live-review-message.schema.ts)
// but on its own channel with its own version, so a playable option frame and a
// live project route never answer each other's messages. Do not fold these two
// version spaces together.
export const PLAYABLE_OPTION_MESSAGE_VERSION = 1 as const

export const PlayableOptionHelloMessageSchema = z.object({
  type: z.literal('design-review/playable-hello'),
  schemaVersion: z.literal(PLAYABLE_OPTION_MESSAGE_VERSION),
  frameId: z.string().min(1),
  token: z.string().uuid(),
})

export const PlayableOptionReadyMessageSchema = z.object({
  type: z.literal('design-review/playable-ready'),
  schemaVersion: z.literal(PLAYABLE_OPTION_MESSAGE_VERSION),
  frameId: z.string().min(1),
  token: z.string().uuid(),
})

export const PlayableOptionMessageSchema = z.discriminatedUnion('type', [
  PlayableOptionHelloMessageSchema,
  PlayableOptionReadyMessageSchema,
])

export type PlayableOptionHelloMessage = z.infer<typeof PlayableOptionHelloMessageSchema>
export type PlayableOptionReadyMessage = z.infer<typeof PlayableOptionReadyMessageSchema>
export type PlayableOptionMessage = z.infer<typeof PlayableOptionMessageSchema>
