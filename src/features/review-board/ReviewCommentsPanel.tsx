import { useEffect } from 'react'
import { AnnotationInstructionEditor } from './AnnotationInstructionEditor'
import { useCollapsedPanelState } from './use-collapsed-panel-state'
import { isInstructionIncomplete } from './model/annotation-instruction'
import { isAnnotationStale } from './model/is-annotation-stale'
import type { AnnotationIntent, BoardDocument } from './model/board-document.schema'
import './ReviewCommentsPanel.css'

export type PoolCopyState = 'idle' | 'copied' | 'failed'

// Supplied only in local app mode, where Send dispatches a coding agent
// instead of posting to a window host.
export interface DispatchAgentOption {
  id: 'claude' | 'codex' | 'cursor'
  available: boolean
}

const DISPATCH_AGENT_LABELS: Record<DispatchAgentOption['id'], string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
}

function roleChip(role: BoardDocument['annotations'][number]['role']): string | null {
  if (role === 'agent-question') return 'question'
  if (role === 'teach') return 'teach'
  return null
}

// Jump list of every annotation. Review notes still edit inline when selected
// (human marks keep the existing editor until issue 09 blooms). Agent questions
// and teach notes jump to their canvas blooms instead — no inline editor here.
export function ReviewCommentsPanel({
  document,
  selectedAnnotationId,
  editorFocusId,
  copiedAnnotationId,
  poolCopyState,
  onJump,
  onSaveDraft,
  onSetIntent,
  onDelete,
  onCopyAnnotation,
  onCopyAll,
  onExport,
  dispatchAgents = null,
  dispatchAgent = 'claude',
  onDispatchAgent,
}: {
  document: BoardDocument
  selectedAnnotationId: string | null
  editorFocusId: string | null
  copiedAnnotationId: string | null
  poolCopyState: PoolCopyState
  onJump: (annotationId: string) => void
  onSaveDraft: (instruction: string) => void
  onSetIntent: (intent: AnnotationIntent | undefined) => void
  onDelete: () => void
  onCopyAnnotation: (annotationId: string) => void
  onCopyAll: () => void
  onExport: () => void
  dispatchAgents?: DispatchAgentOption[] | null
  dispatchAgent?: DispatchAgentOption['id']
  onDispatchAgent?: (agent: DispatchAgentOption['id']) => void
}) {
  const [collapsed, setCollapsed] = useCollapsedPanelState('design-review-comments-collapsed', false)

  // Jumping to a comment must reveal the list so the selected row is visible.
  useEffect(() => {
    if (selectedAnnotationId) setCollapsed(false)
  }, [selectedAnnotationId])

  if (collapsed) {
    return (
      <aside className="comments-panel collapsed" data-testid="comments-panel" aria-label="Pooled review comments">
        <button
          type="button"
          className="comments-toggle"
          aria-expanded={false}
          aria-label={`Expand comments (${document.annotations.length})`}
          title="Expand comments"
          data-testid="toggle-comments-panel"
          onClick={() => setCollapsed(false)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M9.8 3.5 5.3 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="comments-count" data-testid="comments-count">{document.annotations.length}</span>
        </button>
      </aside>
    )
  }

  return (
    <aside className="comments-panel" data-testid="comments-panel" aria-label="Pooled review comments">
      <header className="comments-header">
        <h2>Comments</h2>
        <span className="comments-count" data-testid="comments-count">{document.annotations.length}</span>
        <button
          type="button"
          className="comments-toggle"
          aria-expanded
          aria-label="Collapse comments"
          title="Collapse comments"
          data-testid="toggle-comments-panel"
          onClick={() => setCollapsed(true)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M6.2 3.5 10.7 8l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </header>
      {document.annotations.length === 0 ? (
        <p className="comments-empty">Draw on a screen, pick an element, or drop a comment pin to start the pool.</p>
      ) : (
        <ol className="comments-list">
          {document.annotations.map((annotation) => {
            const frame = document.frames.find((item) => item.id === annotation.frameId)
            if (!frame) return null
            const ordinal = document.annotations
              .filter((item) => item.frameId === annotation.frameId)
              .indexOf(annotation) + 1
            const selected = annotation.id === selectedAnnotationId
            const incomplete = annotation.role === 'review' && isInstructionIncomplete(annotation.instruction)
            const stale = isAnnotationStale(annotation, frame)
            const role = roleChip(annotation.role)
            const subject = annotation.mark?.kind === 'element'
              ? `${annotation.mark.label} · ${frame.label}`
              : frame.label
            return (
              <li
                key={annotation.id}
                className={`comment-item ${selected ? 'selected' : ''}`}
                data-testid={`comment-item-${annotation.id}`}
              >
                <div className="comment-item-row">
                  <button
                    type="button"
                    className="comment-item-open"
                    onClick={() => onJump(annotation.id)}
                    data-testid={`open-comment-${annotation.id}`}
                  >
                    <span className="comment-ordinal">{ordinal}</span>
                    <span className="comment-item-text">
                      <span className="comment-subject">{subject}</span>
                      <span className={`comment-excerpt ${incomplete ? 'incomplete' : ''}`}>
                        {annotation.instruction.trim() || 'No instruction yet'}
                      </span>
                    </span>
                    {role ? <span className={`comment-chip ${role}`}>{role}</span> : null}
                    {annotation.intent ? <span className="comment-chip intent">{annotation.intent}</span> : null}
                    {stale ? <span className="comment-chip">stale</span> : null}
                  </button>
                  {annotation.role === 'review' ? (
                    <button
                      type="button"
                      className="comment-copy"
                      onClick={() => onCopyAnnotation(annotation.id)}
                      data-testid={`copy-comment-${annotation.id}`}
                    >
                      {copiedAnnotationId === annotation.id ? 'Copied' : 'Copy'}
                    </button>
                  ) : null}
                </div>
                {selected && annotation.role === 'review' ? (
                  <AnnotationInstructionEditor
                    annotation={annotation}
                    frame={frame}
                    autoFocus={annotation.id === editorFocusId}
                    onSaveDraft={onSaveDraft}
                    onSetIntent={onSetIntent}
                    onDelete={onDelete}
                  />
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
      <footer className="comments-actions">
        <button type="button" onClick={onCopyAll} data-testid="copy-all-comments">
          {poolCopyState === 'copied' ? 'Copied' : poolCopyState === 'failed' ? 'Copy failed, retry' : 'Copy all'}
        </button>
        {dispatchAgents ? (
          <select
            className="dispatch-agent-select"
            aria-label="Coding agent"
            value={dispatchAgent}
            onChange={(event) => onDispatchAgent?.(event.target.value as DispatchAgentOption['id'])}
            data-testid="dispatch-agent"
          >
            {dispatchAgents.map((agent) => (
              <option key={agent.id} value={agent.id} disabled={!agent.available}>
                {DISPATCH_AGENT_LABELS[agent.id]}{agent.available ? '' : ' (not installed)'}
              </option>
            ))}
          </select>
        ) : null}
        <button type="button" onClick={onExport} data-testid="export-annotation">
          {dispatchAgents ? `Send to ${DISPATCH_AGENT_LABELS[dispatchAgent]}` : 'Send to host'}
        </button>
      </footer>
    </aside>
  )
}
