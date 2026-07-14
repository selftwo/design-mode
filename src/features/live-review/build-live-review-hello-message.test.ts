import { describe, expect, it } from 'vitest'
import { buildLiveReviewHelloMessage } from './build-live-review-hello-message'
import { LiveReviewHelloMessageSchema } from './live-review-message.schema'

describe('buildLiveReviewHelloMessage', () => {
  it('returns a schema-valid hello payload', () => {
    const message = buildLiveReviewHelloMessage(
      'frame-01',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )
    expect(LiveReviewHelloMessageSchema.safeParse(message).success).toBe(true)
    expect(message).toEqual({
      type: 'design-review/live-hello',
      schemaVersion: 1,
      frameId: 'frame-01',
      token: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
  })
})