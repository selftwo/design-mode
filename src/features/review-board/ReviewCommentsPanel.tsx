import { useEffect, useLayoutEffect, useState } from 'react'
import type { Rect } from './island-placement'
import { useCollapsedPanelState } from './use-collapsed-panel-state'
import { isInstructionIncomplete } from './model/annotation-instruction'
import { isAnnotationStale } from './model/is-annotation-stale'
import type { AnnotationIntent, BoardDocument } from './model/board-document.schema'
import { isReviewAnnotation, isTeachAnnotation } from './is-board-annotation'
import { readSelectionBounds } from './read-selection-bounds'
import { SummonedIsland } from './SummonedIsland'
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

export function ReviewCommentsPanel({
  document,
  selectedAnnotationId,
  selectedFrameId,
  selectedElementId,
  copiedAnnotationId,
  poolCopyState,
  onJump,
  onCopyAnnotation,
  onCopyAll,
  onExport,
  dispatchAgents = null,
  dispatchAgent = 'claude',
  onDispatchAgent,
}: {
  document: BoardDocument
  selectedAnnotationId: string | null
  selectedFrameId: string | null
  selectedElementId: string | null
  copiedAnnotationId: string | null
  poolCopyState: PoolCopyState
  onJump: (annotationId: string) => void
  onCopyAnnotation: (annotationId: string) => void
  onCopyAll: () => void
  onExport: () => void
  dispatchAgents?: DispatchAgentOption[] | null
  dispatchAgent?: DispatchAgentOption['id']
  onDispatchAgent?: (agent: DispatchAgentOption['id']) => void
}) {
  const [collapsed, setCollapsed] = useCollapsedPanelState('design-review-comments-collapsed', false)
  const open = document.annotations.length > 0 && !collapsed
  const [selectionBounds, setSelectionBounds] = useState<Rect | null>(null)

  useEffect(() => {
    if (selectedAnnotationId) setCollapsed(false)
  }, [selectedAnnotationId])

  useLayoutEffect(() => {
    if (!open) {
      setSelectionBounds(null)
      return
    }
    let cancelled = false
    let outerFrame = 0
    let innerFrame = 0
    const read = () => {
      if (cancelled) return
      const rect = readSelectionBounds(selectedFrameId, selectedElementId, selectedAnnotationId)
      if (!rect) {
        setSelectionBounds(null)
        return
      }
      setSelectionBounds({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      })
    }
    outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(read)
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(outerFrame)
      window.cancelAnimationFrame(innerFrame)
    }
  }, [open, selectedAnnotationId, selectedElementId, selectedFrameId])

  if (document.annotations.length === 0) return null

  if (collapsed) {
    return (
      <aside className="comments-rail-collapsed dm-island" data-testid="comments-panel" aria-label="Pooled review comments">
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
    <SummonedIsland
      open={open}
      selectionBounds={selectionBounds}
      ariaLabel="Pooled review comments"
      title="Comments"
      testId="comments-panel"
      className="comments-rail-island"
    >
      <div className="comments-rail-body">
        <div className="comments-rail-head">
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
        </div>
        <ol className="comments-list">
          {document.annotations.map((annotation) => {
            const frame = document.frames.find((item) => item.id === annotation.frameId)
            if (!frame) return null
            const ordinal = document.annotations
              .filter((item) => item.frameId === annotation.frameId)
              .indexOf(annotation) + 1
            const selected = annotation.id === selectedAnnotationId
            const incomplete = isReviewAnnotation(annotation) && isInstructionIncomplete(annotation.instruction)
            const stale = isAnnotationStale(annotation, frame)
            const teach = isTeachAnnotation(annotation)
            const subject = annotation.mark?.kind === 'element'
              ? `${annotation.mark.label} · ${frame.label}`
              : frame.label
            return (
              <li
                key={annotation.id}
                className={`comment-item ${selected ? 'selected' : ''} ${teach ? 'comment-item--teach' : ''}`}
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
                      <span className="comment-subject">{teach ? `⌁ ${subject}` : subject}</span>
                      <span className={`comment-excerpt ${incomplete ? 'incomplete' : ''}`}>
                        {annotation.instruction.trim() || (teach ? 'Teach note' : 'No instruction yet')}
                      </span>
                    </span>
                    {isReviewAnnotation(annotation) && annotation.intent ? <span className="comment-chip intent">{annotation.intent}</span> : null}
                    {teach ? <span className="comment-chip teach">teach</span> : null}
                    {stale ? <span className="comment-chip">stale</span> : null}
                  </button>
                  <button
                    type="button"
                    className="comment-copy"
                    onClick={() => onCopyAnnotation(annotation.id)}
                    data-testid={`copy-comment-${annotation.id}`}
                  >
                    {copiedAnnotationId === annotation.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
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
      </div>
    </SummonedIsland>
  )
}
