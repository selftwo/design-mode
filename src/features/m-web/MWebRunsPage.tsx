import { useEffect, useMemo, useState } from 'react'
import type { AgentRun } from '@/features/local-host/host-api.schema'
import { isTeachAnnotation } from '@/features/review-board/is-board-annotation'
import { isAnnotationResolved } from '@/features/review-board/is-annotation-resolved'
import { isAnnotationStale } from '@/features/review-board/model/is-annotation-stale'
import type { BoardDocument, TeachAnnotation } from '@/features/review-board/model/board-document.schema'
import { formatRelativeTime } from './format-relative-time'
import type { MWebClient } from './create-m-web-client'
import { buildMWebHref, type MWebRoute } from './MWebApp'

const AGENT_LABELS: Record<AgentRun['agent'], string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
}

function runStartedLabel(run: AgentRun): string {
  const age = formatRelativeTime(run.startedAt)
  if (run.status === 'running') return `running · started ${age} ago`
  if (run.status === 'done' && run.finishedAt) return `done · ${formatRelativeTime(run.finishedAt)} ago`
  if (run.status === 'failed') return `failed · ${age} ago`
  return run.status
}

export function MWebRunsPage({
  client,
  runs,
  route,
  navigate,
}: {
  client: MWebClient
  runs: AgentRun[]
  route: Extract<MWebRoute, { page: 'runs' }>
  navigate: (route: MWebRoute) => void
}) {
  const [board, setBoard] = useState<BoardDocument | null>(null)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const projectRuns = useMemo(
    () => runs.filter((run) => run.projectId === route.projectId),
    [route.projectId, runs],
  )
  const teachNotes = useMemo(
    () => (board?.annotations ?? []).filter(isTeachAnnotation),
    [board],
  )

  useEffect(() => {
    const loadBoard = () => {
      void client.loadBoard(route.projectId).then(setBoard).catch(() => setBoard(null))
    }
    loadBoard()
    return client.subscribeHostEvents((event) => {
      if (event.type === 'board-updated' && event.projectId === route.projectId) {
        loadBoard()
      }
    })
  }, [client, route.projectId])

  const approveTeach = async (note: TeachAnnotation) => {
    setApprovingId(note.id)
    setApproveError(null)
    try {
      const next = await client.resolveAnnotation(route.projectId, note.id)
      setBoard(next)
    } catch (cause) {
      setApproveError(cause instanceof Error ? cause.message : 'Approval not saved.')
    } finally {
      setApprovingId(null)
    }
  }

  const subtitle = board?.boardId ?? route.projectId

  return (
    <div className="mw-page" data-testid="mweb-runs-page">
      <header className="mw-top">
        <div>
          <h1 className="mw-title">Activity</h1>
          <p className="mw-sub">{subtitle} · runs and teach notes</p>
        </div>
        <button type="button" className="mw-back" onClick={() => navigate({ page: 'boards' })}>
          ‹ Boards
        </button>
      </header>

      <h2 className="mw-sect">Runs</h2>
      {projectRuns.length === 0 ? (
        <div className="mw-empty">
          <p className="mw-empty-title">No runs yet</p>
          <p className="mw-empty-line">Dispatched work shows up here while agents are on it.</p>
        </div>
      ) : null}
      {projectRuns.map((run) => {
        const annotationId = run.annotationIds[0]
        const frame = annotationId
          ? board?.annotations.find((item) => item.id === annotationId)?.frameId
          : undefined
        return (
          <div key={run.id} className="mw-run-row" data-testid={`mweb-run-${run.id}`}>
            <span className="dm-dot" data-state={run.status === 'done' ? 'done' : run.status === 'running' ? 'running' : 'waiting'} aria-hidden="true" />
            <span className="mw-run-title">{`${AGENT_LABELS[run.agent]} · ${run.outputTail.trim().slice(0, 48) || 'working'}`}</span>
            <span className="dm-mono">{run.id.slice(0, 8)}</span>
            <span className="mw-run-detail">{runStartedLabel(run)}</span>
            {run.status === 'running' && run.outputTail.trim() ? (
              <pre className="mw-tail">{run.outputTail.trim()}</pre>
            ) : null}
            {run.status === 'done' && annotationId ? (
              <button
                type="button"
                className="mw-view"
                onClick={() => navigate({
                  page: 'capture',
                  projectId: route.projectId,
                  frameId: frame,
                  annotationId,
                })}
              >
                View change ›
              </button>
            ) : null}
          </div>
        )
      })}

      <h2 className="mw-sect">Teach</h2>
      {approveError ? (
        <p className="dm-notice" data-tone="error" role="alert" data-testid="mweb-teach-approve-error">{approveError}</p>
      ) : null}
      {teachNotes.length === 0 ? (
        <p className="mw-sub">No teach notes on this board yet.</p>
      ) : null}
      {teachNotes.map((note) => {
        const frame = board?.frames.find((item) => item.id === note.frameId)
        const stale = frame ? isAnnotationStale(note, frame) : false
        const resolved = isAnnotationResolved(note)
        const canApprove = !stale && !resolved
        return (
          <article key={note.id} className="mw-teach" data-testid={`mweb-teach-${note.id}`}>
            <div className="mw-teach-head">
              <span className="dm-teach-chip">⌁ teach</span>
              <span className="dm-mono">on {frame?.label ?? note.frameId}</span>
              {resolved ? <span className="dm-thread-state">✓ resolved</span> : null}
            </div>
            <p className="mw-teach-term">{note.instruction}</p>
            <span className="dm-prov dm-mono">{`⌁ run ${note.provenanceRunId.slice(0, 8)} · lens`}</span>
            {canApprove ? (
              <div className="mw-actions">
                <button
                  type="button"
                  className="dm-btn dm-btn--primary"
                  data-testid={`mweb-teach-approve-${note.id}`}
                  disabled={approvingId === note.id}
                  onClick={() => { void approveTeach(note) }}
                >
                  Approve
                </button>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
