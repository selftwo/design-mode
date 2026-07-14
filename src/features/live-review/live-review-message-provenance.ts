import { LiveReviewReadyMessageSchema } from './live-review-message.schema'

export interface LiveReviewReadyContext {
  allowedOrigin: string
  frameId: string
  focusToken: string
  iframeWindow: Window | null
}

export function readTrustedLiveReviewReady(
  event: Pick<MessageEvent, 'data' | 'origin' | 'source'>,
  context: LiveReviewReadyContext,
): { ready: true } | { ready: false; reason: string } {
  if (event.origin !== context.allowedOrigin) {
    return { ready: false, reason: 'wrong-origin' }
  }
  if (!context.iframeWindow || event.source !== context.iframeWindow) {
    return { ready: false, reason: 'wrong-source' }
  }
  const parsed = LiveReviewReadyMessageSchema.safeParse(event.data)
  if (!parsed.success) {
    return { ready: false, reason: 'invalid-schema' }
  }
  if (parsed.data.frameId !== context.frameId) {
    return { ready: false, reason: 'wrong-frame' }
  }
  if (parsed.data.token !== context.focusToken) {
    return { ready: false, reason: 'wrong-token' }
  }
  return { ready: true }
}