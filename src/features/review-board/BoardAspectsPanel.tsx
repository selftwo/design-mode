import type { BoardDocument } from './model/board-document.schema'

export function BoardAspectsPanel({
  document,
  boardLabel,
  captureSource,
}: {
  document: BoardDocument
  boardLabel: string
  captureSource: string | null
}) {
  return (
    <div className="layers-aspects-scroll" data-testid="board-aspects-panel">
      <div className="dm-arow">
        <span className="dm-alabel">Board</span>
        <span className="dm-aval">{boardLabel}</span>
      </div>
      <div className="dm-arow">
        <span className="dm-alabel">Screens</span>
        <span className="dm-aval">{document.frames.length}</span>
      </div>
      <div className="dm-arow">
        <span className="dm-alabel">Annotations</span>
        <span className="dm-aval">{document.annotations.length}</span>
      </div>
      <div className="dm-arow">
        <span className="dm-alabel">Zoom</span>
        <span className="dm-aval dm-mono">{Math.round(document.camera.zoom * 100)}%</span>
      </div>
      {captureSource ? (
        <div className="dm-arow">
          <span className="dm-alabel">Capture</span>
          <span className="dm-aval dm-mono">{captureSource}</span>
        </div>
      ) : null}
    </div>
  )
}
