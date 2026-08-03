import {
  BoardReplyRequestSchema,
  BoardResolveRequestSchema,
  BoardResponseSchema,
  HostErrorSchema,
  HostEventSchema,
  ProjectListSchema,
  RunListSchema,
  type AgentRun,
  type HostEvent,
  type Project,
} from '@/features/local-host/host-api.schema'
import type { BoardDocument } from '@/features/review-board/model/board-document.schema'

async function readError(response: Response): Promise<string> {
  try {
    return HostErrorSchema.parse(await response.json()).error
  } catch {
    return `The local host answered ${response.status}.`
  }
}

// Read and reply only: boards, captures, threads, and runs. No dispatch, capture,
// live sessions, or teach questions on this surface.
export function createMWebClient() {
  return {
    async listProjects(): Promise<Project[]> {
      const response = await fetch('/api/projects')
      if (!response.ok) throw new Error(await readError(response))
      return ProjectListSchema.parse(await response.json()).projects
    },

    async loadBoard(projectId: string): Promise<BoardDocument> {
      const response = await fetch(`/api/projects/${projectId}/board`)
      if (!response.ok) throw new Error(await readError(response))
      return BoardResponseSchema.parse(await response.json()).board
    },

    async saveBoard(projectId: string, board: BoardDocument): Promise<void> {
      const response = await fetch(`/api/projects/${projectId}/board`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(board),
      })
      if (!response.ok) throw new Error(await readError(response))
    },

    async replyToThread(
      projectId: string,
      annotationId: string,
      body: string,
      author = 'Reviewer',
    ): Promise<BoardDocument> {
      const response = await fetch(`/api/projects/${projectId}/board/reply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(BoardReplyRequestSchema.parse({ annotationId, body, author })),
      })
      if (!response.ok) throw new Error(await readError(response))
      return BoardResponseSchema.parse(await response.json()).board
    },

    async resolveAnnotation(projectId: string, annotationId: string): Promise<BoardDocument> {
      const response = await fetch(`/api/projects/${projectId}/board/resolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(BoardResolveRequestSchema.parse({ annotationId })),
      })
      if (!response.ok) throw new Error(await readError(response))
      return BoardResponseSchema.parse(await response.json()).board
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

export type MWebClient = ReturnType<typeof createMWebClient>
