import {
  LIVE_REVIEW_MESSAGE_VERSION,
  LiveReviewHelloMessageSchema,
  type LiveReviewHelloMessage,
} from './live-review-message.schema'

export function buildLiveReviewHelloMessage(frameId: string, focusToken: string): LiveReviewHelloMessage {
  return LiveReviewHelloMessageSchema.parse({
    type: 'design-review/live-hello',
    schemaVersion: LIVE_REVIEW_MESSAGE_VERSION,
    frameId,
    token: focusToken,
  })
}