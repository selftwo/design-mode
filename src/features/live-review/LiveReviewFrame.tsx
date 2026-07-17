import { useRef } from 'react'
import { useLiveReviewConnection } from './use-live-review-connection'
import type { LiveConnectionState } from './use-live-review-connection'
import './LiveReviewFrame.css'

export type { LiveConnectionState }

export interface LiveReviewFrameConfig {
  frameId: string
  liveUrl: string
  allowedOrigin: string
  focusToken: string
}

export function LiveReviewFrame({ config }: { config: LiveReviewFrameConfig }) {
  const { frameId, liveUrl } = config
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { connectionState, sendHello } = useLiveReviewConnection(config, iframeRef)

  const stateLabel = connectionState === 'ready'
    ? 'Live ready'
    : connectionState === 'unavailable'
      ? 'Live unavailable'
      : 'Connecting'

  return (
    <div
      className="live-frame"
      data-testid={`live-frame-${frameId}`}
      data-ready={String(connectionState === 'ready')}
      data-connection-state={connectionState}
    >
      <iframe
        ref={iframeRef}
        className="nodrag nopan nowheel"
        src={liveUrl}
        title={`Live ${frameId}`}
        onLoad={sendHello}
        data-testid={`live-iframe-${frameId}`}
      />
      <span className="live-state" role="status" data-testid={`live-state-${frameId}`}>
        {stateLabel}
      </span>
    </div>
  )
}