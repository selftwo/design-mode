import { useEffect, useRef } from 'react'
import './AnnotationInstructionEditor.css'
import type { AnnotationIntent, ReviewAnnotation, ScreenFrame } from './model/board-document.schema'
import { ANNOTATION_INTENTS, ANNOTATION_INTENT_GUIDANCE } from './model/annotation-intent'
import { isInstructionIncomplete } from './model/annotation-instruction'
import { isAnnotationStale } from './model/is-annotation-stale'

export function AnnotationInstructionEditor({
  annotation,
  frame,
  autoFocus,
  onSaveDraft,
  onSetIntent,
  onDelete,
}: {
  annotation: ReviewAnnotation
  frame: ScreenFrame
  autoFocus: boolean
  onSaveDraft: (instruction: string) => void
  onSetIntent: (intent: AnnotationIntent | undefined) => void
  onDelete: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const incomplete = isInstructionIncomplete(annotation.instruction)
  const stale = isAnnotationStale(annotation, frame)

  // Focus is requested for deliberate navigation (creation, banner jump), not for
  // inspecting an existing mark, so selection never yanks focus away from the mark.
  // Retry once after paint: React Flow may remount the node when the board updates.
  useEffect(() => {
    if (!autoFocus) return
    const focus = () => textareaRef.current?.focus()
    focus()
    const frame = requestAnimationFrame(() => {
      focus()
      requestAnimationFrame(focus)
    })
    return () => cancelAnimationFrame(frame)
  }, [autoFocus, annotation.id])

  return (
    <aside
      className="annotation-editor"
      data-testid="annotation-instruction-editor"
      aria-label="Annotation instruction"
    >
      <header className="annotation-editor-header">
        <label htmlFor="annotation-instruction">Instruction</label>
        <span data-testid="selected-annotation-id">{annotation.id}</span>
        {stale ? (
          <span className="annotation-stale" role="status" data-testid="annotation-stale">
            Stale capture
          </span>
        ) : null}
        {incomplete ? (
          <span className="annotation-incomplete" role="status" data-testid="instruction-incomplete">
            Incomplete draft
          </span>
        ) : (
          <span className="annotation-complete" role="status" data-testid="instruction-complete">
            Draft saved
          </span>
        )}
      </header>
      <textarea
        id="annotation-instruction"
        ref={textareaRef}
        data-testid="instruction-input"
        aria-invalid={incomplete}
        value={annotation.instruction}
        placeholder="Describe what the agent should review…"
        onChange={(event) => onSaveDraft(event.target.value)}
      />
      <div className="annotation-intents" role="group" aria-label="Design intent">
        {ANNOTATION_INTENTS.map((intent) => (
          <button
            key={intent}
            type="button"
            className="intent-chip"
            aria-pressed={annotation.intent === intent}
            title={ANNOTATION_INTENT_GUIDANCE[intent]}
            data-testid={`intent-${intent}`}
            onClick={() => onSetIntent(annotation.intent === intent ? undefined : intent)}
          >
            {intent}
          </button>
        ))}
      </div>
      <button type="button" data-testid="delete-annotation" onClick={onDelete}>
        Delete annotation
      </button>
    </aside>
  )
}