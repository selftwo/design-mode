import type { BoardDocument } from './model/board-document.schema'

export interface BoardSaveQueue {
  // Runs one write at a time, in call order. The returned promise settles with
  // that write's own result (including the host-acknowledged board); the
  // internal chain absorbs failures so a later write still runs.
  enqueue(document: BoardDocument): Promise<BoardDocument>
}

// A tiny browser-side serializer for whole-board saves. Its only job is to keep
// an older PUT from finishing after a newer one, so the immediate-save gate
// before generation is truthful. Compare-and-save / 409 handling lives in the
// persistence hook and the host write queue.
export function createBoardSaveQueue(
  write: (document: BoardDocument) => BoardDocument | Promise<BoardDocument>,
): BoardSaveQueue {
  let tail: Promise<void> = Promise.resolve()
  return {
    enqueue(document: BoardDocument): Promise<BoardDocument> {
      const run = tail.then(
        () => write(document),
        () => write(document),
      )
      tail = run.then(
        () => {},
        () => {},
      )
      return run
    },
  }
}
