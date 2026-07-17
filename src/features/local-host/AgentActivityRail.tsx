import { useState } from 'react'
import type { AgentRun } from './host-api.schema'
import './AgentActivityRail.css'

const AGENT_LABELS: Record<AgentRun['agent'], string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
}

function runSummary(run: AgentRun): string {
  const target = `${run.annotationIds.length} annotation${run.annotationIds.length === 1 ? '' : 's'}`
  if (run.status === 'queued') return `queued with ${target}`
  if (run.status === 'running') return `working on ${target}`
  if (run.status === 'done') return `finished ${target}`
  return run.error ?? 'failed'
}

// Agents appear on the board the way collaborators appear in a multiplayer
// design tool: a presence chip while they work, a record when they finish.
export function AgentActivityRail({
  runs,
  capturing,
}: {
  runs: AgentRun[]
  capturing: boolean
}) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  if (runs.length === 0 && !capturing) return null

  return (
    <aside className="agent-activity" aria-label="Agent activity" data-testid="agent-activity">
      {capturing ? (
        <p className="agent-activity-row" data-testid="capture-activity">
          <span className="agent-presence-dot capturing" aria-hidden="true" />
          Refreshing captures…
        </p>
      ) : null}
      {runs.slice(0, 5).map((run) => (
        <div key={run.id} className="agent-activity-run" data-testid={`agent-run-${run.id}`}>
          <button
            type="button"
            className="agent-activity-row"
            onClick={() => setExpandedRunId((current) => (current === run.id ? null : run.id))}
            aria-expanded={expandedRunId === run.id}
          >
            <span className={`agent-presence-dot ${run.status}`} aria-hidden="true" />
            <strong>{AGENT_LABELS[run.agent]}</strong>
            <span className="agent-run-summary" data-testid={`agent-run-status-${run.id}`}>{runSummary(run)}</span>
          </button>
          {expandedRunId === run.id && run.outputTail ? (
            <pre className="agent-run-output">{run.outputTail}</pre>
          ) : null}
        </div>
      ))}
    </aside>
  )
}
