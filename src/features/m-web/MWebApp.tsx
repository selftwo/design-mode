import { useEffect, useMemo, useState } from 'react'
import type { AgentRun } from '@/features/local-host/host-api.schema'
import { isServedByLocalHost } from '@/features/local-host/local-host-detection'
import { useThemeState } from '@/features/review-board/use-theme-state'
import { createMWebClient } from './create-m-web-client'
import { MWebBoardsPage } from './MWebBoardsPage'
import { MWebCapturePage } from './MWebCapturePage'
import { MWebNoticesPage } from './MWebNoticesPage'
import { MWebRunsPage } from './MWebRunsPage'

export type MWebRoute =
  | { page: 'boards' }
  | { page: 'capture'; projectId: string; frameId?: string; annotationId?: string }
  | { page: 'runs'; projectId: string }
  | { page: 'notices' }

export function parseMWebRoute(hash: string): MWebRoute {
  const path = hash.replace(/^#/, '') || '/boards'
  const url = new URL(path, 'http://mweb.local')
  if (url.pathname === '/boards' || url.pathname === '/') return { page: 'boards' }
  if (url.pathname === '/notices') return { page: 'notices' }
  const captureMatch = url.pathname.match(/^\/projects\/([^/]+)\/capture\/?$/)
  if (captureMatch) {
    return {
      page: 'capture',
      projectId: captureMatch[1]!,
      frameId: url.searchParams.get('frame') ?? undefined,
      annotationId: url.searchParams.get('annotation') ?? undefined,
    }
  }
  const runsMatch = url.pathname.match(/^\/projects\/([^/]+)\/runs\/?$/)
  if (runsMatch) return { page: 'runs', projectId: runsMatch[1]! }
  return { page: 'boards' }
}

export function buildMWebHref(route: MWebRoute): string {
  if (route.page === 'boards') return '#/boards'
  if (route.page === 'notices') return '#/notices'
  if (route.page === 'runs') return `#/projects/${route.projectId}/runs`
  const params = new URLSearchParams()
  if (route.frameId) params.set('frame', route.frameId)
  if (route.annotationId) params.set('annotation', route.annotationId)
  const query = params.toString()
  return `#/projects/${route.projectId}/capture${query ? `?${query}` : ''}`
}

function useMWebRoute(): [MWebRoute, (route: MWebRoute) => void] {
  const [route, setRoute] = useState<MWebRoute>(() => parseMWebRoute(window.location.hash))
  useEffect(() => {
    const onHashChange = () => setRoute(parseMWebRoute(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  const navigate = (next: MWebRoute) => {
    const href = buildMWebHref(next)
    if (window.location.hash !== href) window.location.hash = href
    setRoute(next)
  }
  return [route, navigate]
}

export function MWebApp() {
  const [route, navigate] = useMWebRoute()
  const [theme, setTheme] = useThemeState()
  const client = useMemo(() => (isServedByLocalHost() ? createMWebClient() : null), [])
  const [runs, setRuns] = useState<AgentRun[]>([])

  useEffect(() => {
    if (!client) return
    void client.listRuns().then(setRuns).catch(() => setRuns([]))
    return client.subscribeHostEvents((event) => {
      if (event.type === 'run-updated') {
        setRuns((current) => [event.run, ...current.filter((run) => run.id !== event.run.id)])
      }
    })
  }, [client])

  if (!client) {
    return (
      <main className="mw-load-state" data-testid="mweb-host-required">
        <h1 className="mw-title">m-web review companion</h1>
        <p className="mw-sub">Open this surface through the design-mode host.</p>
      </main>
    )
  }

  return (
    <div className="dm" data-testid="mweb-app">
      <div className="mw-banner-stack" aria-live="polite">
        <button
          type="button"
          className="dm-btn dm-btn--quiet mw-theme-toggle"
          data-testid="mweb-theme-toggle"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>
      </div>
      {route.page === 'boards' ? (
        <MWebBoardsPage client={client} runs={runs} navigate={navigate} />
      ) : null}
      {route.page === 'capture' ? (
        <MWebCapturePage client={client} runs={runs} route={route} navigate={navigate} />
      ) : null}
      {route.page === 'runs' ? (
        <MWebRunsPage client={client} runs={runs} route={route} navigate={navigate} />
      ) : null}
      {route.page === 'notices' ? (
        <MWebNoticesPage navigate={navigate} />
      ) : null}
    </div>
  )
}
