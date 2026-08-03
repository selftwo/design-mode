import { useEffect, useMemo, useState } from 'react'
import type { AgentRun } from '@/features/local-host/host-api.schema'
import type { BoardDocument } from '@/features/review-board/model/board-document.schema'
import { buildBoardListEntry, type BoardListEntry } from './build-board-list-entry'
import type { MWebClient } from './create-m-web-client'
import type { HostEvent, Project } from '@/features/local-host/host-api.schema'
import type { MWebRoute } from './MWebApp'
import { buildMWebHref } from './MWebApp'

function runLabel(run: AgentRun | null): string {
  if (!run) return 'no runs'
  const short = run.id.length > 8 ? run.id.slice(0, 8) : run.id
  return `${short} ${run.status}`
}

export function MWebBoardsPage({
  client,
  runs,
  navigate,
}: {
  client: MWebClient
  runs: AgentRun[]
  navigate: (route: MWebRoute) => void
}) {
  const [projects, setProjects] = useState<Array<{ project: Project; board: BoardDocument | null }> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const listedProjects = await client.listProjects()
        const rows = await Promise.all(listedProjects.map(async (project) => {
          let board: BoardDocument | null = null
          try {
            board = await client.loadBoard(project.id)
          } catch {
            board = null
          }
          return { project, board }
        }))
        if (!cancelled) setProjects(rows)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Boards could not be loaded.')
        }
      }
    })()
    return () => { cancelled = true }
  }, [client])

  useEffect(() => {
    if (!projects) return
    return client.subscribeHostEvents((event: HostEvent) => {
      if (event.type !== 'board-updated' && event.type !== 'capture-started' && event.type !== 'capture-failed') return
      void Promise.all(projects.map(async ({ project }) => {
        try {
          return { project, board: await client.loadBoard(project.id) }
        } catch {
          return { project, board: null }
        }
      })).then(setProjects)
    })
  }, [client, projects])

  const entries = useMemo(
    () => projects?.map(({ project, board }) => buildBoardListEntry(project.id, project.name, board, runs)) ?? null,
    [projects, runs],
  )

  return (
    <div className="mw-page" data-testid="mweb-boards-page">
      <header className="mw-top">
        <div>
          <h1 className="mw-title">Boards</h1>
          <p className="mw-sub">Reviews in progress. Read, reply, approve.</p>
        </div>
        <span className="dm-mono">m-web</span>
      </header>

      {error ? <p className="dm-notice" data-tone="error" role="alert">{error}</p> : null}
      {entries === null ? <p className="mw-sub">Loading boards…</p> : null}
      {entries?.map((entry) => (
        <a
          key={entry.projectId}
          className="mw-board"
          data-testid={`mweb-board-${entry.projectId}`}
          href={buildMWebHref({
            page: 'capture',
            projectId: entry.projectId,
            frameId: entry.projectId,
          })}
          onClick={(event) => {
            event.preventDefault()
            navigate({
              page: 'capture',
              projectId: entry.projectId,
            })
          }}
        >
          <div className="mw-board-head">
            <span className="mw-board-title">{entry.title}</span>
            <span className="dm-mono">{entry.ageLabel}</span>
          </div>
          {entry.thumbUrls.length > 0 ? (
            <div className="mw-thumbs" aria-hidden="true">
              {entry.thumbUrls.map((url, index) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  className={`mw-thumb ${index === entry.thumbUrls.length - 1 && entry.thumbUrls.length > 1 ? 'mw-thumb--narrow' : ''}`}
                />
              ))}
            </div>
          ) : null}
          <div className="mw-board-foot">
            <span className={`mw-open ${entry.openThreadCount === 0 ? 'mw-open--none' : ''}`}>
              {entry.openThreadCount === 0
                ? 'No open threads'
                : `${entry.openThreadCount} thread${entry.openThreadCount === 1 ? '' : 's'} open`}
            </span>
            <span className="mw-run">
              {entry.latestRun ? <span className="dm-dot" data-state={entry.latestRun.status === 'done' ? 'done' : entry.latestRun.status === 'running' ? 'running' : 'waiting'} aria-hidden="true" /> : null}
              <span className="dm-mono">{runLabel(entry.latestRun)}</span>
            </span>
          </div>
        </a>
      ))}

      <a
        className="mw-back"
        href={buildMWebHref({ page: 'notices' })}
        onClick={(event) => {
          event.preventDefault()
          navigate({ page: 'notices' })
        }}
      >
        Notices ›
      </a>
    </div>
  )
}
