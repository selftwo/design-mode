import { useMemo, useRef } from 'react'
import { usePlayableOptionConnection } from './use-playable-option-connection'
import './PlayableOptionFrame.css'

export type PlayableInteractionMode = 'play' | 'review'

export interface PlayableOptionFrameProps {
  frameId: string
  // The durable scratch path from frame.liveSource.path, served same-origin by
  // the host. Resolved against the app origin at mount.
  sourcePath: string
  interactionMode: PlayableInteractionMode
}

// A playable lo-fi option mounted as a sandboxed iframe. It is served same-origin
// from the host scratch route but sandboxed as allow-scripts without
// allow-same-origin, so it runs at an opaque origin and cannot touch the app.
// The screenshot shell stays beneath it (in ScreenFrameNode) as the fallback for
// connecting and unavailable states.
export function PlayableOptionFrame({ frameId, sourcePath, interactionMode }: PlayableOptionFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // One token per mount, carried in the URL hash and checked on ready.
  const tokenRef = useRef<string>('')
  if (!tokenRef.current) tokenRef.current = crypto.randomUUID()
  const token = tokenRef.current

  const src = useMemo(
    () => `${sourcePath}#token=${token}&frameId=${encodeURIComponent(frameId)}`,
    [sourcePath, token, frameId],
  )

  const { connectionState, sendHello } = usePlayableOptionConnection(
    { frameId, token, allowedOrigin: 'null' },
    iframeRef,
  )

  const stateLabel = connectionState === 'ready'
    ? 'Playable ready'
    : connectionState === 'unavailable'
      ? 'Playable unavailable'
      : 'Connecting'

  return (
    <div
      className={`playable-frame ${interactionMode}`}
      data-testid={`playable-frame-${frameId}`}
      data-ready={String(connectionState === 'ready')}
      data-connection-state={connectionState}
      data-mode={interactionMode}
    >
      <iframe
        ref={iframeRef}
        className="nodrag nopan nowheel"
        src={src}
        title={`Playable ${frameId}`}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        onLoad={sendHello}
        data-testid={`playable-iframe-${frameId}`}
      />
      <span className="playable-state" role="status" data-testid={`playable-state-${frameId}`}>
        {stateLabel}
      </span>
    </div>
  )
}
