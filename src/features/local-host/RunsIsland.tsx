import { useState } from 'react'
import type { AgentRun } from './host-api.schema'
import './RunsIsland.css'

const AGENT_LABELS: Record<AgentRun['agent'], string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
}

function runSummary(run: AgentRun): string {
  // Generation runs belong to a unit and carry no annotations; describe them as
  // option generation rather than "0 annotations".
  const target = run.unitId
    ? 'design options'
    : `${run.annotationIds.length} annotation${run.annotationIds.length === 1 ? '' : 's'}`
  if (run.status === 'queued') return `queued with ${target}`
  if (run.status === 'running') return `working on ${target}`
  if (run.status === 'done') return `finished ${target}`
  return run.error ?? 'failed'
}

// Dot states map queued → waiting so the catalog vocabulary stays one place.
function dotState(status: AgentRun['status']): 'running' | 'done' | 'failed' | 'waiting' {
  if (status === 'queued') return 'waiting'
  return status
}

// The runs island: active and recent agent runs, fed by host SSE. Replaces the
// old AgentActivityRail. Present only while runs exist or a capture is in flight.
// Green is the only hue; the running dot does not pulse.
export function RunsIsland({
  runs,
  capturing,
}: {
  runs: AgentRun[]
  capturing: boolean
}) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  if (runs.length === 0 && !capturing) return null

  return (
    <aside className="runs-island" aria-label="Agent runs" data-testid="agent-activity">
      <header className="runs-island-header">
        <h2>Runs</h2>
      </header>
      {capturing ? (
        <p className="runs-island-row" data-testid="capture-activity">
          <span className="runs-dot" data-state="running" aria-hidden="true" />
          <span className="runs-note">Refreshing captures…</span>
        </p>
      ) : null}
      {runs.slice(0, 8).map((run) => {
        const expanded = expandedRunId === run.id
        return (
          <div key={run.id} className="runs-island-run" data-testid={`agent-run-${run.id}`}>
            <button
              type="button"
              className="runs-island-row"
              onClick={() => setExpandedRunId((current) => (current === run.id ? null : run.id))}
              aria-expanded={expanded}
            >
              <span className="runs-dot" data-state={dotState(run.status)} aria-hidden="true" />
              <span className="runs-mono" title={run.id}>
                {run.id.slice(0, 8)} · {AGENT_LABELS[run.agent]}
              </span>
              <span className="runs-note" data-testid={`agent-run-status-${run.id}`}>
                {runSummary(run)}
              </span>
            </button>
            {expanded && run.outputTail ? (
              <pre className="runs-tail" aria-label={`${run.id} output tail`}>{run.outputTail}</pre>
            ) : null}
          </div>
        )
      })}
    </aside>
  )
}
