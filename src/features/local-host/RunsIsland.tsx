import { useLayoutEffect, useState } from 'react'
import type { Rect } from '@/features/review-board/island-placement'
import { readSelectionBounds } from '@/features/review-board/read-selection-bounds'
import { SummonedIsland } from '@/features/review-board/SummonedIsland'
import type { AgentRun } from './host-api.schema'
import './RunsIsland.css'

const AGENT_LABELS: Record<AgentRun['agent'], string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
}

function runNote(run: AgentRun): string {
  const target = `${run.annotationIds.length} annotation${run.annotationIds.length === 1 ? '' : 's'}`
  if (run.status === 'queued') return `queued · ${target}`
  if (run.status === 'running') return `running · ${target}`
  if (run.status === 'done') return `done · ${target}`
  return run.error ? `failed · ${run.error}` : 'failed'
}

function dotState(status: AgentRun['status']): 'running' | 'done' | 'failed' | 'waiting' {
  if (status === 'queued') return 'waiting'
  if (status === 'running') return 'running'
  if (status === 'done') return 'done'
  return 'failed'
}

export function RunsIsland({
  runs,
  capturing,
  selectedFrameId,
  selectedElementId,
  selectedAnnotationId,
}: {
  runs: AgentRun[]
  capturing: boolean
  selectedFrameId: string | null
  selectedElementId: string | null
  selectedAnnotationId: string | null
}) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const open = runs.length > 0 || capturing
  const [selectionBounds, setSelectionBounds] = useState<Rect | null>(null)

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

  return (
    <SummonedIsland
      open={open}
      selectionBounds={selectionBounds}
      ariaLabel="Agent runs"
      title="Runs"
      testId="agent-activity"
      className="runs-island"
    >
      <div className="runs-island-body">
        {capturing ? (
          <div className="dm-run-row" data-testid="capture-activity" role="status">
            <span className="dm-dot" data-state="running" aria-hidden="true" />
            <span className="dm-mono">capture</span>
            <span>Refreshing captures…</span>
          </div>
        ) : null}
        {runs.map((run) => {
          const expanded = expandedRunId === run.id
          return (
            <div key={run.id} className="runs-island-run" data-testid={`agent-run-${run.id}`}>
              <button
                type="button"
                className="dm-run-row runs-row-button"
                onClick={() => setExpandedRunId((current) => (current === run.id ? null : run.id))}
                aria-expanded={expanded}
                aria-label={`${AGENT_LABELS[run.agent]} run ${run.id.slice(0, 8)}`}
              >
                <span className="dm-dot" data-state={dotState(run.status)} aria-hidden="true" />
                <span className="dm-mono">
                  {run.id.slice(0, 8)} · {run.agent}
                </span>
                <span data-testid={`agent-run-status-${run.id}`}>{runNote(run)}</span>
              </button>
              {expanded && run.outputTail ? (
                <pre className="runs-output-tail dm-mono" aria-label={`${run.id.slice(0, 8)} output tail`}>
                  {run.outputTail}
                </pre>
              ) : null}
            </div>
          )
        })}
      </div>
    </SummonedIsland>
  )
}
