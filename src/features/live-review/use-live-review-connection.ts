import { useEffect, useRef, useState, type RefObject } from 'react'
import { buildLiveReviewHelloMessage } from './build-live-review-hello-message'
import { readTrustedLiveReviewReady } from './live-review-message-provenance'
import {
  createLiveReviewTerminalGuard,
  type LiveConnectionState,
} from './live-review-terminal-state'

export type { LiveConnectionState }

export interface LiveReviewConnectionConfig {
  frameId: string
  liveUrl: string
  allowedOrigin: string
  focusToken: string
}

const HELLO_INTERVAL_MS = 1000
export const LIVE_REVIEW_CONNECT_TIMEOUT_MS = 10_000

export function useLiveReviewConnection(
  config: LiveReviewConnectionConfig,
  iframeRef: RefObject<HTMLIFrameElement | null>,
) {
  const { frameId, liveUrl, allowedOrigin, focusToken } = config
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
    const message = buildLiveReviewHelloMessage(frameId, focusToken)
    iframeRef.current?.contentWindow?.postMessage(message, allowedOrigin)
  }

  useEffect(() => {
    terminalGuardRef.current = createLiveReviewTerminalGuard()
    setConnectionState('connecting')
    clearTimers()
    detachMessageListener()

    const onMessage = (event: MessageEvent) => {
      if (terminalGuardRef.current.isTerminal()) return
      const result = readTrustedLiveReviewReady(event, {
        allowedOrigin,
        frameId,
        focusToken,
        iframeWindow: iframeRef.current?.contentWindow ?? null,
      })
      if (result.ready) markReady()
    }
    onMessageRef.current = onMessage
    window.addEventListener('message', onMessage)

    retryIntervalRef.current = window.setInterval(sendHello, HELLO_INTERVAL_MS)
    connectTimeoutRef.current = window.setTimeout(markUnavailable, LIVE_REVIEW_CONNECT_TIMEOUT_MS)
    sendHello()

    return () => {
      terminalGuardRef.current.markUnavailable()
      clearTimers()
      detachMessageListener()
    }
  }, [allowedOrigin, frameId, focusToken, liveUrl, iframeRef])

  return { connectionState, sendHello }
}