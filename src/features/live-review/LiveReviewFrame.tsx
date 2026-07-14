import { useEffect, useMemo, useRef, useState } from 'react'
import { LiveReviewReadyMessageSchema, type LiveReviewHelloMessage } from './live-review-message.schema'

export const LIVE_FIXTURE_ORIGIN = 'http://127.0.0.1:5199'

export function createFocusToken(): string {
  return crypto.randomUUID()
}

export function LiveReviewFrame({ frameId, token }: { frameId: string; token: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const source = useMemo(() => {
    const url = new URL('/live-review.html', LIVE_FIXTURE_ORIGIN)
    url.hash = new URLSearchParams({ token }).toString()
    return url.toString()
  }, [token])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const iframe = iframeRef.current
      if (!iframe) return
      if (event.origin !== LIVE_FIXTURE_ORIGIN) return
      if (event.source !== iframe.contentWindow) return
      const message = LiveReviewReadyMessageSchema.safeParse(event.data)
      if (!message.success || message.data.token !== token) return
      setReady(true)
    }
    window.addEventListener('message', onMessage)
    const retry = window.setInterval(() => {
      if (ready) return
      const message: LiveReviewHelloMessage = { type: 'design-review/hello', token }
      iframeRef.current?.contentWindow?.postMessage(message, LIVE_FIXTURE_ORIGIN)
    }, 1000)
    return () => {
      window.removeEventListener('message', onMessage)
      window.clearInterval(retry)
    }
  }, [ready, token])

  const sendHello = () => {
    const message: LiveReviewHelloMessage = { type: 'design-review/hello', token }
    iframeRef.current?.contentWindow?.postMessage(message, LIVE_FIXTURE_ORIGIN)
  }

  return (
    <div className="live-frame" data-testid={`live-frame-${frameId}`} data-ready={String(ready)}>
      <iframe
        ref={iframeRef}
        className="nodrag nopan nowheel"
        src={source}
        title={`Live ${frameId}`}
        onLoad={sendHello}
        data-testid={`live-iframe-${frameId}`}
      />
      <span className="live-state" data-testid={`live-state-${frameId}`}>
        {ready ? 'Live ready' : 'Connecting'}
      </span>
    </div>
  )
}
