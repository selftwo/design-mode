import type { Page } from '@playwright/test'
import type { BoardDocument } from '../../src/features/review-board/model/board-document.schema'
import type { AgentRun } from '../../src/features/local-host/host-api.schema'
import { appendThreadReply } from '../../src/features/review-board/append-thread-reply'
import { resolveBoardAnnotation } from '../../src/features/review-board/resolve-board-annotation'
import { createMWebTestBoard } from '../../src/test-support/create-m-web-test-board'

export type FakeMWebHostOptions = {
  projectId?: string
  projectName?: string
  runs?: AgentRun[]
}

export async function installFakeMWebHost(
  page: Page,
  initialBoard?: BoardDocument,
  options?: FakeMWebHostOptions,
) {
  const projectId = options?.projectId ?? 'smalltools'
  const projectName = options?.projectName ?? 'smalltools'
  let board = structuredClone(initialBoard ?? createMWebTestBoard())
  const runs = options?.runs ?? []

  await page.addInitScript(() => {
    if (location.pathname.includes('m-web')) {
      window.__designModeHost = { version: 1 }
    }
  })

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const { pathname } = url

    if (pathname === '/api/projects' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projects: [{
            id: projectId,
            name: projectName,
            path: '/tmp/smalltools',
            devCommand: 'npm run dev',
            devPort: 5173,
            routes: [{ id: 'home', label: 'Home', path: '/' }],
            registeredAt: '2026-07-17T00:00:00.000Z',
          }],
        }),
      })
      return
    }

    if (pathname === `/api/projects/${projectId}/board` && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ board }),
      })
      return
    }

    if (pathname === `/api/projects/${projectId}/board` && request.method() === 'PUT') {
      board = JSON.parse(request.postData() ?? '{}') as BoardDocument
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ saved: true }),
      })
      return
    }

    if (pathname === `/api/projects/${projectId}/board/reply` && request.method() === 'POST') {
      const payload = JSON.parse(request.postData() ?? '{}') as {
        annotationId?: string
        body?: string
        author?: string
      }
      if (!payload.annotationId || !payload.body?.trim()) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid reply.' }) })
        return
      }
      board = appendThreadReply(board, payload.annotationId, payload.body, payload.author ?? 'Reviewer')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ board }),
      })
      return
    }

    if (pathname === `/api/projects/${projectId}/board/resolve` && request.method() === 'POST') {
      const payload = JSON.parse(request.postData() ?? '{}') as { annotationId?: string }
      if (!payload.annotationId) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid resolve.' }) })
        return
      }
      board = resolveBoardAnnotation(board, payload.annotationId)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ board }),
      })
      return
    }

    if (pathname === '/api/runs' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ runs }),
      })
      return
    }

    if (pathname === '/api/events' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': connected\n\n',
      })
      return
    }

    await route.fulfill({ status: 404, body: JSON.stringify({ error: `Unhandled ${request.method()} ${pathname}` }) })
  })

  return {
    getBoard: () => structuredClone(board),
  }
}
