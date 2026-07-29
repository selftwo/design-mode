import { BoardDocumentSchema, type BoardDocument } from '../src/features/review-board/model/board-document.schema.ts'
import type { HostDataStore } from './host-data-store.ts'

export type CompareAndSaveResult =
  | { ok: true; board: BoardDocument }
  | { ok: false; conflict: BoardDocument }

export class BoardMissingForSaveError extends Error {
  constructor() {
    super('Board is missing; save with baseRevision 0 to create it.')
    this.name = 'BoardMissingForSaveError'
  }
}

// Serializes every board write for one project so capture, agent merges, and
// reviewer PUTs never interleave read-modify-write. The host alone bumps
// documentRevision on a successful persist.
export function createProjectBoardWriteQueue(store: HostDataStore) {
  const tails = new Map<string, Promise<unknown>>()

  function enqueue<T>(projectId: string, job: () => T | Promise<T>): Promise<T> {
    const previous = tails.get(projectId) ?? Promise.resolve()
    const run = previous.then(
      () => job(),
      () => job(),
    )
    tails.set(projectId, run.then(
      () => {},
      () => {},
    ))
    return run
  }

  function revisionOf(board: BoardDocument | null): number {
    return board?.documentRevision ?? 0
  }

  function persist(projectId: string, board: BoardDocument, nextRevision: number): BoardDocument {
    const persisted = BoardDocumentSchema.parse({ ...board, documentRevision: nextRevision })
    store.writeBoard(projectId, persisted)
    return persisted
  }

  return {
    // Reviewer PUT: succeeds only when baseRevision matches what is on disk.
    // baseRevision 0 creates the first board at documentRevision 1.
    compareAndSave(
      projectId: string,
      input: { baseRevision: number; board: BoardDocument },
    ): Promise<CompareAndSaveResult> {
      return enqueue(projectId, () => {
        const current = store.readBoard(projectId)
        const currentRevision = revisionOf(current)
        if (currentRevision !== input.baseRevision) {
          if (!current) throw new BoardMissingForSaveError()
          return { ok: false as const, conflict: current }
        }
        return { ok: true as const, board: persist(projectId, input.board, currentRevision + 1) }
      })
    },

    // Capture / merge paths: read the latest board (or null), mutate, write with
    // a bumped revision. Always goes through the same per-project chain. An
    // async mutator holds the chain until it settles, so a slow merge and a
    // direct save can never interleave their read-modify-write.
    mutateAndSave(
      projectId: string,
      mutate: (current: BoardDocument | null) => BoardDocument | Promise<BoardDocument>,
    ): Promise<BoardDocument> {
      return enqueue(projectId, async () => {
        const current = store.readBoard(projectId)
        const next = await mutate(current)
        return persist(projectId, next, revisionOf(current) + 1)
      })
    },

    // Like mutateAndSave, but skips the write (and revision bump) when the
    // mutator reports no change. Used by idempotent canvas-event ingest.
    mutateAndSaveIfChanged(
      projectId: string,
      mutate: (current: BoardDocument | null) => { board: BoardDocument; changed: boolean },
    ): Promise<{ board: BoardDocument; changed: boolean }> {
      return enqueue(projectId, () => {
        const current = store.readBoard(projectId)
        const result = mutate(current)
        if (!result.changed) return { board: result.board, changed: false }
        return { board: persist(projectId, result.board, revisionOf(current) + 1), changed: true }
      })
    },
  }
}

export type ProjectBoardWriteQueue = ReturnType<typeof createProjectBoardWriteQueue>
