import type { BoardHost } from '../review-board/host/window-board-host'
import type { HostBoardLoadResult } from '../review-board/host/host-board-message.schema'
import type { HostCaptureRefreshResult, HostLiveSessionResult } from '../review-board/host/host-live-message.schema'
import type { HostReviewBatchDeliveryResult } from '../review-board/host/host-review-batch-message.schema'
import type { BoardDocument } from '../review-board/model/board-document.schema'
import type { ReviewBatch } from '../review-board/model/review-batch'
import {
  AgentListSchema,
  BoardResponseSchema,
  DispatchAcceptedSchema,
  HostErrorSchema,
  HostEventSchema,
  LiveSessionResponseSchema,
  ProjectContextSchema,
  ProjectListSchema,
  ProjectSchema,
  RunListSchema,
  type AgentAvailability,
  type AgentId,
  type AgentRun,
  type ContextFile,
  type HostEvent,
  type Project,
  type ProjectRegistration,
} from './host-api.schema'

async function readError(response: Response): Promise<string> {
  try {
    return HostErrorSchema.parse(await response.json()).error
  } catch {
    return `The local host answered ${response.status}.`
  }
}

// The same BoardHost contract the window message host implements, spoken over
// the local app's HTTP API, plus the project, context, and agent operations
// that only exist when the local host is present.
export function createLocalHostClient(projectId: string | null) {
  const boardListeners = new Set<(result: HostBoardLoadResult) => void>()
  const liveListeners = new Set<(result: HostLiveSessionResult) => void>()
  const refreshListeners = new Set<(result: HostCaptureRefreshResult) => void>()
  const deliveryListeners = new Set<(result: HostReviewBatchDeliveryResult) => void>()
  let dispatchAgent: AgentId = 'claude'
  let boardAtLoad: BoardDocument | null = null

  const emit = <T>(listeners: Set<(result: T) => void>, result: T) => {
    for (const listener of listeners) listener(result)
  }

  async function putBoard(board: BoardDocument): Promise<void> {
    const response = await fetch(`/api/projects/${projectId}/board`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(board),
    })
    if (!response.ok) throw new Error(await readError(response))
  }

  const boardHost: BoardHost = {
    requestBoard() {
      if (!projectId) return
      fetch(`/api/projects/${projectId}/board`)
        .then(async (response) => {
          if (!response.ok) {
            emit(boardListeners, { status: 'rejected', error: await readError(response) })
            return
          }
          const { board } = BoardResponseSchema.parse(await response.json())
          boardAtLoad = board
          emit(boardListeners, { status: 'loaded', board })
        })
        .catch((error: unknown) => {
          emit(boardListeners, {
            status: 'rejected',
            error: error instanceof Error ? error.message : 'The local host is not reachable.',
          })
        })
    },
    subscribe(listener) {
      boardListeners.add(listener)
      return () => boardListeners.delete(listener)
    },
    requestLiveSession(frameId, requestId) {
      fetch(`/api/projects/${projectId}/live`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ frameId }),
      })
        .then(async (response) => {
          if (!response.ok) {
            emit(liveListeners, { status: 'rejected', requestId, frameId, error: await readError(response) })
            return
          }
          const session = LiveSessionResponseSchema.parse(await response.json())
          emit(liveListeners, { status: 'ready', requestId, frameId, ...session })
        })
        .catch((error: unknown) => {
          emit(liveListeners, {
            status: 'rejected',
            requestId,
            frameId,
            error: error instanceof Error ? error.message : 'The live session request failed.',
          })
        })
    },
    subscribeLiveSession(listener) {
      liveListeners.add(listener)
      return () => liveListeners.delete(listener)
    },
    requestCaptureRefresh(frameId, requestId) {
      fetch(`/api/projects/${projectId}/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ frameId }),
      })
        .then(async (response) => {
          if (!response.ok) {
            emit(refreshListeners, { status: 'failed', requestId, frameId, error: await readError(response) })
            return
          }
          const { board } = BoardResponseSchema.parse(await response.json())
          const frame = board.frames.find((item) => item.id === frameId)
          if (!frame) {
            emit(refreshListeners, { status: 'failed', requestId, frameId, error: `Frame ${frameId} disappeared from the board.` })
            return
          }
          emit(refreshListeners, {
            status: 'refreshed',
            requestId,
            frameId,
            screenshotPath: frame.screenshotPath,
            screenshotDataUrl: frame.screenshotDataUrl,
            refreshedScreenshotDataUrl: frame.refreshedScreenshotDataUrl,
            captureHash: frame.captureHash,
          })
        })
        .catch((error: unknown) => {
          emit(refreshListeners, {
            status: 'failed',
            requestId,
            frameId,
            error: error instanceof Error ? error.message : 'The capture refresh failed.',
          })
        })
    },
    subscribeCaptureRefresh(listener) {
      refreshListeners.add(listener)
      return () => refreshListeners.delete(listener)
    },
    deliverReviewBatch(batch: ReviewBatch, requestId) {
      fetch(`/api/projects/${projectId}/dispatch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent: dispatchAgent, batch }),
      })
        .then(async (response) => {
          if (!response.ok) {
            emit(deliveryListeners, { status: 'failed', requestId, error: await readError(response) })
            return
          }
          DispatchAcceptedSchema.parse(await response.json())
          emit(deliveryListeners, { status: 'delivered', requestId })
        })
        .catch((error: unknown) => {
          emit(deliveryListeners, {
            status: 'failed',
            requestId,
            error: error instanceof Error ? error.message : 'The agent dispatch failed.',
          })
        })
    },
    subscribeReviewBatchDelivery(listener) {
      deliveryListeners.add(listener)
      return () => deliveryListeners.delete(listener)
    },
  }

  return {
    ...boardHost,
    activeProjectId: projectId,

    setDispatchAgent(agent: AgentId) {
      dispatchAgent = agent
    },

    // Autosave storage for the persistence hook. Reset restores the board that
    // was loaded this session, so the host file matches what the reviewer sees.
    boardStorage: {
      save: (board: BoardDocument) => putBoard(board),
      clear: () => {
        if (boardAtLoad) void putBoard(boardAtLoad).catch(() => {})
      },
    },

    async listProjects(): Promise<Project[]> {
      const response = await fetch('/api/projects')
      if (!response.ok) throw new Error(await readError(response))
      return ProjectListSchema.parse(await response.json()).projects
    },

    async registerProject(registration: ProjectRegistration): Promise<Project> {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(registration),
      })
      if (!response.ok) throw new Error(await readError(response))
      const body = await response.json() as { project: unknown }
      return ProjectSchema.parse(body.project)
    },

    async captureProject(targetProjectId: string): Promise<void> {
      const response = await fetch(`/api/projects/${targetProjectId}/capture`, { method: 'POST' })
      if (!response.ok) throw new Error(await readError(response))
    },

    async getContext(): Promise<ContextFile[]> {
      const response = await fetch(`/api/projects/${projectId}/context`)
      if (!response.ok) throw new Error(await readError(response))
      return ProjectContextSchema.parse(await response.json()).files
    },

    async listAgents(): Promise<AgentAvailability[]> {
      const response = await fetch('/api/agents')
      if (!response.ok) throw new Error(await readError(response))
      return AgentListSchema.parse(await response.json()).agents
    },

    async listRuns(): Promise<AgentRun[]> {
      const response = await fetch('/api/runs')
      if (!response.ok) throw new Error(await readError(response))
      return RunListSchema.parse(await response.json()).runs
    },

    subscribeHostEvents(listener: (event: HostEvent) => void): () => void {
      const source = new EventSource('/api/events')
      source.onmessage = (message) => {
        const parsed = HostEventSchema.safeParse(JSON.parse(message.data as string))
        if (parsed.success) listener(parsed.data)
      }
      return () => source.close()
    },
  }
}

export type LocalHostClient = ReturnType<typeof createLocalHostClient>
