import type { ScreenFrame } from './model/board-document.schema'

export function FrameAspectsPanel({ frame }: { frame: ScreenFrame }) {
  return (
    <div className="layers-aspects-scroll" data-testid="frame-aspects-panel">
      <div className="dm-arow">
        <span className="dm-alabel">Label</span>
        <span className="dm-aval">{frame.label}</span>
      </div>
      <div className="dm-arow">
        <span className="dm-alabel">Route</span>
        <span className="dm-aval dm-mono">{frame.route || '/'}</span>
      </div>
      <div className="dm-arow">
        <span className="dm-alabel">Viewport</span>
        <span className="dm-aval dm-mono">{frame.viewport.width} × {frame.viewport.height}</span>
      </div>
      <div className="dm-arow">
        <span className="dm-alabel">Revision</span>
        <span className="dm-aval dm-mono">{frame.revision}</span>
      </div>
      <div className="dm-arow">
        <span className="dm-alabel">Capture hash</span>
        <span className="dm-aval dm-mono">{frame.captureHash}</span>
      </div>
      <div className="dm-arow">
        <span className="dm-alabel">Elements</span>
        <span className="dm-aval">{frame.elements.length}</span>
      </div>
    </div>
  )
}
