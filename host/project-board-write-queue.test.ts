import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BoardDocument } from '../src/features/review-board/model/board-document.schema.ts'
import { createHostDataStore } from './host-data-store.ts'
import { createProjectBoardWriteQueue } from './project-board-write-queue.ts'

const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function sampleBoard(overrides: Partial<BoardDocument> = {}): BoardDocument {
  return {
    schemaVersion: 2,
    boardId: 'queue-test-board',
    documentRevision: 999,
    camera: { worldX: 0, worldY: 0, zoom: 1 },
    frames: [],
    annotations: [],
    units: [],
    zones: [],
    verdicts: [],
    reviewSummaries: [],
    ...overrides,
  }
}

describe('project board write queue', () => {
  let dataDir: string
  let store: ReturnType<typeof createHostDataStore>
  let queue: ReturnType<typeof createProjectBoardWriteQueue>
  const projectId = 'write-queue-project'

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'board-write-queue-'))
    store = createHostDataStore(dataDir)
    queue = createProjectBoardWriteQueue(store)
  })

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true })
  })

  it('compareAndSave create (base 0) assigns documentRevision 1', async () => {
    const result = await queue.compareAndSave(projectId, { baseRevision: 0, board: sampleBoard() })
    expect(result).toEqual({ ok: true, board: expect.objectContaining({ documentRevision: 1 }) })
    expect(store.readBoard(projectId)?.documentRevision).toBe(1)
  })

  it('compareAndSave success bumps documentRevision', async () => {
    const first = await queue.compareAndSave(projectId, { baseRevision: 0, board: sampleBoard({ boardId: 'v1' }) })
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const second = await queue.compareAndSave(projectId, {
      baseRevision: first.board.documentRevision,
      board: sampleBoard({ boardId: 'v2' }),
    })
    expect(second).toEqual({ ok: true, board: expect.objectContaining({ documentRevision: 2, boardId: 'v2' }) })
  })

  it('compareAndSave stale baseRevision returns conflict with current board', async () => {
    const first = await queue.compareAndSave(projectId, { baseRevision: 0, board: sampleBoard() })
    expect(first.ok).toBe(true)
    if (!first.ok) return

    await queue.compareAndSave(projectId, {
      baseRevision: first.board.documentRevision,
      board: sampleBoard({ boardId: 'current' }),
    })

    const stale = await queue.compareAndSave(projectId, {
      baseRevision: first.board.documentRevision,
      board: sampleBoard({ boardId: 'stale-write' }),
    })
    expect(stale.ok).toBe(false)
    if (stale.ok) return
    expect(stale.conflict.documentRevision).toBe(2)
    expect(stale.conflict.boardId).toBe('current')
    expect(store.readBoard(projectId)?.boardId).toBe('current')
  })

  it('mutateAndSave serializes writes and bumps documentRevision', async () => {
    const saved = await queue.mutateAndSave(projectId, (current) => {
      expect(current).toBeNull()
      return sampleBoard({ frames: [{ id: 'f1', label: 'F1', route: '/', viewport: { width: 100, height: 100 }, x: 0, y: 0, width: 100, height: 62.5, aspectRatio: 1.6, screenshotPath: 's.png', screenshotDataUrl: dataUrl, refreshedScreenshotDataUrl: dataUrl, captureHash: 'h', revision: 1, elements: [], kind: 'captured-route', lifeState: 'active' }] })
    })
    expect(saved.documentRevision).toBe(1)
    expect(store.readBoard(projectId)?.frames).toHaveLength(1)
  })

  it('two mutateAndSave jobs run sequentially with revisions 1→2→3', async () => {
    await queue.compareAndSave(projectId, { baseRevision: 0, board: sampleBoard({ boardId: 'initial' }) })

    const seenBaseRevisions: number[] = []
    const first = queue.mutateAndSave(projectId, (current) => {
      seenBaseRevisions.push(current!.documentRevision)
      return sampleBoard({ boardId: 'step-2' })
    })
    const second = queue.mutateAndSave(projectId, (current) => {
      seenBaseRevisions.push(current!.documentRevision)
      return sampleBoard({ boardId: 'step-3' })
    })

    const [board2, board3] = await Promise.all([first, second])
    expect(board2.documentRevision).toBe(2)
    expect(board3.documentRevision).toBe(3)
    expect(seenBaseRevisions).toEqual([1, 2])
    expect(store.readBoard(projectId)?.boardId).toBe('step-3')
  })
})
