import { useEffect, useRef, useState, type RefObject } from 'react'
import { buildPlayableOptionHelloMessage } from './build-playable-option-hello-message'
import { readTrustedPlayableOptionReady } from './playable-option-message-provenance'
import { createLiveReviewTerminalGuard, type LiveConnectionState } from '../live-review/live-review-terminal-state'

export type { LiveConnectionState }

export interface PlayableOptionConnectionConfig {
  frameId: string
  // A fresh token per iframe mount, echoed in the URL hash and checked on ready,
  // so a message from a prior mount cannot be mistaken for this one.
  token: string
  // 'null' for a sandboxed opaque-origin frame; the source-window and token
  // checks carry the real trust.
  allowedOrigin: string
}

const HELLO_INTERVAL_MS = 1000
export const PLAYABLE_OPTION_CONNECT_TIMEOUT_MS = 10_000
// The sandboxed option frame (allow-scripts, no allow-same-origin) has an opaque
// origin that cannot be named as a target, so hello goes to any target. The
// bridge replies to the parent's real origin, and we verify the source window.
const HELLO_TARGET_ORIGIN = '*'

// The playable-option handshake, mirroring useLiveReviewConnection on the
// playable channel: retry hello until the frame answers ready, then stop; give
// up after a timeout. Distinct from the project-route live session.
export function usePlayableOptionConnection(
  config: PlayableOptionConnectionConfig,
  iframeRef: RefObject<HTMLIFrameElement | null>,
) {
  const { frameId, token, allowedOrigin } = config
  const [connectionState, setConnectionState] = useState<LiveConnectionState>('connecting')
  const terminalGuardRef = useRef(createLiveReviewTerminalGuard())
  const retryIntervalRef = useRef<number | null>(null)
  const connectTimeoutRef = useRef<number | null>(null)
  const onMessageRef = useRef<((event: MessageEvent) => void) | null>(null)

  const clearTimers = () => {
    if (retryIntervalRef.current !== null) {
      window.clearInterval(retryIntervalRef.current)
      retryIntervalRef.current = null
    }
    if (connectTimeoutRef.current !== null) {
      window.clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }
  }

  const detachMessageListener = () => {
    if (onMessageRef.current) {
      window.removeEventListener('message', onMessageRef.current)
      onMessageRef.current = null
    }
  }

  const markReady = () => {
    if (!terminalGuardRef.current.markReady()) return
    clearTimers()
    detachMessageListener()
    setConnectionState('ready')
  }

  const markUnavailable = () => {
    if (!terminalGuardRef.current.markUnavailable()) return
    clearTimers()
    detachMessageListener()
    setConnectionState('unavailable')
  }

  const sendHello = () => {
    if (terminalGuardRef.current.isTerminal()) return
    const message = buildPlayableOptionHelloMessage(frameId, token)
    iframeRef.current?.contentWindow?.postMessage(message, HELLO_TARGET_ORIGIN)
  }

  useEffect(() => {
    terminalGuardRef.current = createLiveReviewTerminalGuard()
    setConnectionState('connecting')
    clearTimers()
    detachMessageListener()

    const onMessage = (event: MessageEvent) => {
      if (terminalGuardRef.current.isTerminal()) return
      const result = readTrustedPlayableOptionReady(event, {
        allowedOrigin,
        frameId,
        token,
        iframeWindow: iframeRef.current?.contentWindow ?? null,
      })
      if (result.ready) markReady()
    }
    onMessageRef.current = onMessage
    window.addEventListener('message', onMessage)

    retryIntervalRef.current = window.setInterval(sendHello, HELLO_INTERVAL_MS)
    connectTimeoutRef.current = window.setTimeout(markUnavailable, PLAYABLE_OPTION_CONNECT_TIMEOUT_MS)
    sendHello()

    return () => {
      terminalGuardRef.current.markUnavailable()
      clearTimers()
      detachMessageListener()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedOrigin, frameId, token, iframeRef])

  return { connectionState, sendHello }
}
