import type { BoardDocument } from './model/board-document.schema'

export interface BoardSaveQueue {
  // Runs one write at a time. While a write is in flight, a newly enqueued
  // document replaces any not-yet-started pending one, so a burst of autosaves
  // costs at most one trailing write. Every displaced enqueue promise settles
  // with the result of the write that actually carried its superseded document.
  enqueue(document: BoardDocument): Promise<BoardDocument>
}

interface PendingSave {
  document: BoardDocument
  settlers: Array<{
    resolve: (board: BoardDocument) => void
    reject: (error: unknown) => void
  }>
}

// A tiny browser-side serializer for whole-board saves. It keeps an older PUT
// from finishing after a newer one, so the immediate-save gate before
// generation is truthful, and it coalesces queued documents because each save
// ships the whole board — only the newest queued document matters.
// Compare-and-save / 409 handling lives in the persistence hook and the host
// write queue.
export function createBoardSaveQueue(
  write: (document: BoardDocument) => BoardDocument | Promise<BoardDocument>,
): BoardSaveQueue {
  let inFlight = false
  let pending: PendingSave | null = null

  const runNext = (): void => {
    if (inFlight || !pending) return
    const job = pending
    pending = null
    inFlight = true
    Promise.resolve()
      .then(() => write(job.document))
      .then(
        (saved) => job.settlers.forEach((settler) => settler.resolve(saved)),
        (error: unknown) => job.settlers.forEach((settler) => settler.reject(error)),
      )
      .finally(() => {
        inFlight = false
        runNext()
      })
  }

  return {
    enqueue(document: BoardDocument): Promise<BoardDocument> {
      return new Promise((resolve, reject) => {
        if (pending) {
          pending.document = document
          pending.settlers.push({ resolve, reject })
        } else {
          pending = { document, settlers: [{ resolve, reject }] }
        }
        runNext()
      })
    },
  }
}
