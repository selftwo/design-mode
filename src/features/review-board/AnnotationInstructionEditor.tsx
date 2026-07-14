import { useEffect, useRef } from 'react'
import './AnnotationInstructionEditor.css'
import type { ReviewAnnotation } from './model/board-document.schema'
import { isInstructionIncomplete } from './model/annotation-instruction'

export function AnnotationInstructionEditor({
  annotation,
  onSaveDraft,
  onDelete,
}: {
  annotation: ReviewAnnotation
  onSaveDraft: (instruction: string) => void
  onDelete: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const incomplete = isInstructionIncomplete(annotation.instruction)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [annotation.id])

  return (
    <aside
      className="annotation-editor"
      data-testid="annotation-instruction-editor"
      aria-label="Annotation instruction"
    >
      <header className="annotation-editor-header">
        <label htmlFor="annotation-instruction">Instruction</label>
        <span data-testid="selected-annotation-id">{annotation.id}</span>
        {incomplete ? (
          <span className="annotation-incomplete" data-testid="instruction-incomplete">
            Incomplete draft
          </span>
        ) : (
          <span className="annotation-complete" data-testid="instruction-complete">
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
      <button type="button" data-testid="delete-annotation" onClick={onDelete}>
        Delete annotation
      </button>
    </aside>
  )
}