import type { BoardHost } from '../review-board/host/window-board-host'
import type { HostBoardLoadResult } from '../review-board/host/host-board-message.schema'
import type { HostCaptureRefreshResult, HostLiveSessionResult } from '../review-board/host/host-live-message.schema'
import type { HostReviewBatchDeliveryResult } from '../review-board/host/host-review-batch-message.schema'
import type { BoardDocument } from '../review-board/model/board-document.schema'
import type { ReviewBatch } from '../review-board/model/review-batch'
import {
  AgentListSchema,
  BoardConflictResponseSchema,
  BoardPutSuccessSchema,
  BoardResponseSchema,
  DispatchAcceptedSchema,
  GenerateOptionsAcceptedSchema,
  HostErrorSchema,
  HostEventSchema,
  LearnAcceptedSchema,
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

// A host request failure that carries the HTTP status, so a caller can tell a
// 404 (unit gone) from a 409 (unit locked or blocked) apart from other errors.
export class LocalHostRequestError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'LocalHostRequestError'
    this.status = status
  }
}

// Compare-and-save conflict: the host board moved ahead of the client's
// baseRevision. Carries the authoritative board so the client can refresh its
// revision baseline without clobbering local edits.
export class BoardRevisionConflictError extends Error {
  readonly status = 409
  readonly documentRevision: number
  readonly board: BoardDocument
  constructor(message: string, documentRevision: number, board: BoardDocument) {
    super(message)
    this.name = 'BoardRevisionConflictError'
    this.documentRevision = documentRevision
    this.board = board
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

  async function putBoard(input: { baseRevision: number; board: BoardDocument }): Promise<BoardDocument> {
    const response = await fetch(`/api/projects/${projectId}/board`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRevision: input.baseRevision, board: input.board }),
    })
    if (response.status === 409) {
      const conflict = BoardConflictResponseSchema.parse(await response.json())
      throw new BoardRevisionConflictError(conflict.error, conflict.documentRevision, conflict.board)
    }
    if (!response.ok) throw new LocalHostRequestError(await readError(response), response.status)
    return BoardPutSuccessSchema.parse(await response.json()).board
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
      save: (input: { board: BoardDocument; baseRevision: number }) => putBoard(input),
      clear: async () => {
        if (!boardAtLoad || !projectId) return
        try {
          const response = await fetch(`/api/projects/${projectId}/board`)
          if (!response.ok) return
          const { board: current } = BoardResponseSchema.parse(await response.json())
          await putBoard({
            baseRevision: current.documentRevision,
            board: boardAtLoad,
          })
        } catch {
          // A failed reset write surfaces through confirmReset / applyImmediateReset.
        }
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

    // Ask the current dispatch agent to generate lo-fi HTML options for a design
    // unit. The host builds the agent text from the unit's brief and rules, so no
    // prompt is sent. Returns the journaled run; options land on a later capture.
    // Throws a LocalHostRequestError so the caller can distinguish 404 from 409.
    async generateOptions(input: { unitId: string; count?: number }): Promise<AgentRun> {
      const response = await fetch(`/api/projects/${projectId}/generate-options`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent: dispatchAgent, unitId: input.unitId, count: input.count ?? 3 }),
      })
      if (!response.ok) throw new LocalHostRequestError(await readError(response), response.status)
      return GenerateOptionsAcceptedSchema.parse(await response.json()).run
    },

    // Ask the current dispatch agent to answer a question about one screen and pin
    // the answer as a teach note. The agent echoes requestId on its teach-answer
    // event, so the canvas can match the pinned answer to this ask. Returns the
    // journaled run; the teach annotation arrives later over the board-patched SSE.
    async requestLearnAnswer(input: {
      frameId: string
      anchor: [number, number]
      question: string
      requestId: string
      elementLabel?: string
    }): Promise<AgentRun> {
      const response = await fetch(`/api/projects/${projectId}/learn`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent: dispatchAgent, ...input }),
      })
      if (!response.ok) throw new LocalHostRequestError(await readError(response), response.status)
      return LearnAcceptedSchema.parse(await response.json()).run
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
