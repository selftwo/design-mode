import type { TeachAnnotation } from './model/board-document.schema'
import { isAnnotationStale } from './model/is-annotation-stale'
import { isAnnotationResolved } from './is-annotation-resolved'
import type { ScreenFrame } from './model/board-document.schema'
import './TeachAnnotationNote.css'

const STEM_LENGTH_PX = 32

function teachChipLabel(annotation: TeachAnnotation, stale: boolean): string {
  const anchor = `▢ ${annotation.mark.label}`
  return stale ? `⌁ teach · stale ${anchor}` : `⌁ teach · anchored ${anchor}`
}

export function TeachAnnotationNotes({
  annotations,
  frame,
  selectedAnnotationId,
  onSelectAnnotation,
  onDelete,
}: {
  annotations: TeachAnnotation[]
  frame: ScreenFrame
  selectedAnnotationId: string | null
  onSelectAnnotation: (annotationId: string) => void
  onDelete: (annotationId: string) => void
}) {
  return (
    <>
      {annotations.map((annotation) => {
        const selected = annotation.id === selectedAnnotationId
        const stale = isAnnotationStale(annotation, frame)
        const resolved = isAnnotationResolved(annotation)
        const [start, end] = annotation.mark.points
        const anchorTop = ((start[1] + end[1]) / 2) * 100
        const anchorLeft = end[0] * 100
        const noteTop = start[1] * 100
        return (
          <div key={annotation.id} className="teach-note-anchor" style={{ left: `${anchorLeft}%`, top: `${anchorTop}%` }}>
            <div
              className="dm-teach-stem"
              data-open="true"
              style={{ width: `${STEM_LENGTH_PX}px`, height: '1px' }}
              aria-hidden="true"
            />
            <div
              className={`dm-teach-note teach-note-on-frame ${stale ? 'teach-note-on-frame--stale' : ''} ${selected ? 'teach-note-on-frame--selected' : ''}`}
              data-open="true"
              data-stale={String(stale)}
              data-resolved={String(resolved)}
              data-annotation-id={annotation.id}
              data-testid={`teach-note-${annotation.id}`}
              aria-label={`Teach annotation on ${annotation.mark.label}`}
              style={{ left: `${STEM_LENGTH_PX}px`, top: `${noteTop - anchorTop}%` }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onSelectAnnotation(annotation.id)
              }}
            >
              <span className="dm-teach-chip" data-testid={`teach-chip-${annotation.id}`}>
                {teachChipLabel(annotation, stale)}
              </span>
              <div className="dm-thread-c">
                <div className="dm-comment-head">
                  <span className="dm-avatar dm-avatar--agent" aria-hidden="true">⌁</span>
                  <span className="dm-comment-author">Agent</span>
                  {resolved ? <span className="dm-thread-state" data-testid={`teach-resolved-${annotation.id}`}>✓ resolved</span> : null}
                </div>
                <span className="dm-prov dm-mono" data-testid={`teach-provenance-${annotation.id}`}>
                  {`⌁ run ${annotation.provenanceRunId.slice(0, 8)} · learn`}
                </span>
                <p className="dm-comment-body" data-testid={`teach-body-${annotation.id}`}>{annotation.instruction}</p>
              </div>
              {selected && !resolved ? (
                <div className="teach-note-actions">
                  <button
                    type="button"
                    className="dm-btn dm-btn--quiet dm-btn--sm"
                    data-testid={`delete-teach-${annotation.id}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onDelete(annotation.id)
                    }}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </>
  )
}
