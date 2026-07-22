import { PlayableOptionReadyMessageSchema } from './playable-option-message.schema'

// Structural event/context shapes so this check runs in the host (Node) and in
// the browser (1d's connection hook) without a DOM lib dependency. A real
// MessageEvent and Window satisfy these fields.
export interface PlayableOptionReadyEvent {
  data: unknown
  origin: string
  source: unknown
}

export interface PlayableOptionReadyContext {
  allowedOrigin: string
  frameId: string
  token: string
  iframeWindow: unknown
}

// Confirms a playable-ready message came from the frame we handed the token to.
// Same check order and reason strings as readTrustedLiveReviewReady, on the
// playable channel.
export function readTrustedPlayableOptionReady(
  event: PlayableOptionReadyEvent,
  context: PlayableOptionReadyContext,
): { ready: true } | { ready: false; reason: string } {
  if (event.origin !== context.allowedOrigin) {
    return { ready: false, reason: 'wrong-origin' }
  }
  if (!context.iframeWindow || event.source !== context.iframeWindow) {
    return { ready: false, reason: 'wrong-source' }
  }
  const parsed = PlayableOptionReadyMessageSchema.safeParse(event.data)
  if (!parsed.success) {
    return { ready: false, reason: 'invalid-schema' }
  }
  if (parsed.data.frameId !== context.frameId) {
    return { ready: false, reason: 'wrong-frame' }
  }
  if (parsed.data.token !== context.token) {
    return { ready: false, reason: 'wrong-token' }
  }
  return { ready: true }
}
