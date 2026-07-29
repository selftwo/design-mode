import { describe, expect, it } from 'vitest'
import { createBoardSaveQueue } from './board-save-queue'
import type { BoardDocument } from './model/board-document.schema'

function boardWithId(id: string, revision = 1): BoardDocument {
  return {
    schemaVersion: 2,
    boardId: id,
    documentRevision: revision,
    camera: { worldX: 0, worldY: 0, zoom: 1 },
    frames: [],
    annotations: [],
    units: [],
    zones: [],
    verdicts: [],
    reviewSummaries: [],
  }
}

function deferred() {
  let resolve!: (value: BoardDocument) => void
  let reject!: (error: Error) => void
  const promise = new Promise<BoardDocument>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('createBoardSaveQueue', () => {
  it('runs writes one at a time in call order', async () => {
    const started: string[] = []
    const gates: Record<string, ReturnType<typeof deferred>> = { one: deferred(), two: deferred() }
    const queue = createBoardSaveQueue((document) => {
      started.push(document.boardId)
      return gates[document.boardId]!.promise
    })

    const first = queue.enqueue(boardWithId('one'))
    const second = queue.enqueue(boardWithId('two'))

    // Writes run on a microtask; flush once so the first can start.
    await new Promise((resolve) => setTimeout(resolve, 0))
    // The second write must not have started while the first is pending.
    expect(started).toEqual(['one'])
    gates.one!.resolve(boardWithId('one', 2))
    await expect(first).resolves.toMatchObject({ boardId: 'one', documentRevision: 2 })
    // Let the queue advance to the second write, still pending on its own gate.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(started).toEqual(['one', 'two'])
    gates.two!.resolve(boardWithId('two', 3))
    await expect(second).resolves.toMatchObject({ boardId: 'two', documentRevision: 3 })
  })

  it('starts the next write even after the previous one fails', async () => {
    const seen: string[] = []
    const queue = createBoardSaveQueue((document) => {
      seen.push(document.boardId)
      if (document.boardId === 'bad') return Promise.reject(new Error('nope'))
      return Promise.resolve(boardWithId('good', 2))
    })

    await expect(queue.enqueue(boardWithId('bad'))).rejects.toThrow('nope')
    await expect(queue.enqueue(boardWithId('good'))).resolves.toMatchObject({ boardId: 'good' })
    expect(seen).toEqual(['bad', 'good'])
  })

  it('coalesces a burst: three enqueues during one in-flight write cost two writes', async () => {
    const started: string[] = []
    const gate = deferred()
    const queue = createBoardSaveQueue((document) => {
      started.push(document.boardId)
      if (document.boardId === 'one') return gate.promise
      return Promise.resolve(boardWithId(document.boardId, 9))
    })

    const first = queue.enqueue(boardWithId('one'))
    const second = queue.enqueue(boardWithId('two'))
    const third = queue.enqueue(boardWithId('three'))

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(started).toEqual(['one'])
    gate.resolve(boardWithId('one', 2))

    await expect(first).resolves.toMatchObject({ boardId: 'one', documentRevision: 2 })
    // The displaced middle enqueue settles with the result of the save that
    // carried its superseded document: the newer one.
    await expect(second).resolves.toMatchObject({ boardId: 'three', documentRevision: 9 })
    await expect(third).resolves.toMatchObject({ boardId: 'three', documentRevision: 9 })
    // Only the first and last documents ever reached storage, in call order.
    expect(started).toEqual(['one', 'three'])
  })

  it('rejects displaced enqueues when the carrying write fails', async () => {
    const gate = deferred()
    const queue = createBoardSaveQueue((document) => {
      if (document.boardId === 'one') return gate.promise
      return Promise.reject(new Error('carrier failed'))
    })

    const first = queue.enqueue(boardWithId('one'))
    const second = queue.enqueue(boardWithId('two'))
    const third = queue.enqueue(boardWithId('three'))
    gate.resolve(boardWithId('one', 2))

    await expect(first).resolves.toMatchObject({ boardId: 'one', documentRevision: 2 })
    await expect(second).rejects.toThrow('carrier failed')
    await expect(third).rejects.toThrow('carrier failed')
  })

  it('reports each write its own result', async () => {
    const queue = createBoardSaveQueue((document) =>
      document.boardId === 'fail'
        ? Promise.reject(new Error('x'))
        : Promise.resolve(boardWithId('ok', 2)))
    const ok = queue.enqueue(boardWithId('ok'))
    const fail = queue.enqueue(boardWithId('fail'))
    await expect(ok).resolves.toMatchObject({ boardId: 'ok', documentRevision: 2 })
    await expect(fail).rejects.toThrow('x')
  })
})
