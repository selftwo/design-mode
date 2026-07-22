import {
  PLAYABLE_OPTION_MESSAGE_VERSION,
  PlayableOptionHelloMessageSchema,
  type PlayableOptionHelloMessage,
} from './playable-option-message.schema'

export function buildPlayableOptionHelloMessage(frameId: string, token: string): PlayableOptionHelloMessage {
  return PlayableOptionHelloMessageSchema.parse({
    type: 'design-review/playable-hello',
    schemaVersion: PLAYABLE_OPTION_MESSAGE_VERSION,
    frameId,
    token,
  })
}
