import './LiveReviewFrame.css'

export function LiveFrameHostConnecting({ frameId }: { frameId: string }) {
  return (
    <div
      className="live-frame live-frame-host-connecting"
      data-testid={`live-frame-${frameId}`}
      data-ready="false"
      data-connection-state="connecting"
    >
      <span className="live-state" data-testid={`live-state-${frameId}`}>
        Connecting
      </span>
    </div>
  )
}