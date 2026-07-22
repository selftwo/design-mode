import { describe, expect, it } from 'vitest'
import { buildPlayableOptionHelloMessage } from './build-playable-option-hello-message'
import { PlayableOptionHelloMessageSchema } from './playable-option-message.schema'

describe('buildPlayableOptionHelloMessage', () => {
  it('returns a schema-valid hello payload on the playable channel', () => {
    const message = buildPlayableOptionHelloMessage(
      'frame-01',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )
    expect(PlayableOptionHelloMessageSchema.safeParse(message).success).toBe(true)
    expect(message).toEqual({
      type: 'design-review/playable-hello',
      schemaVersion: 1,
      frameId: 'frame-01',
      token: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
  })
})
