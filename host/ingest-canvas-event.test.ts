import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BoardDocument, ScreenFrame } from '../src/features/review-board/model/board-document.schema.ts'
import type { CanvasEvent } from '../src/features/review-board/model/canvas-event.schema.ts'
import type { HostEvent } from '../src/features/local-host/host-api.schema.ts'
import { createHostDataStore } from './host-data-store.ts'
import { createHostEventBus } from './host-event-bus.ts'
import { createProjectBoardWriteQueue } from './project-board-write-queue.ts'
import { canvasEventsPath, ingestCanvasEvent, syncCanvasEventsFromFile } from './ingest-canvas-event.ts'

const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const projectId = 'ingest-test-project'
const runId = 'ingest-test-run'

function homeFrame(): ScreenFrame {
  return {
    id: 'home',
    label: 'Home',
    route: '/',
    viewport: { width: 100, height: 100 },
    x: 0,
    y: 0,
    width: 100,
    height: 62.5,
    aspectRatio: 1.6,
    screenshotPath: 's.png',
    screenshotDataUrl: dataUrl,
    refreshedScreenshotDataUrl: dataUrl,
    captureHash: 'home-hash',
    revision: 1,
    elements: [],
    kind: 'captured-route',
    lifeState: 'active',
  }
}

function sampleBoard(): BoardDocument {
  return {
    schemaVersion: 2,
    boardId: 'ingest-test-board',
    documentRevision: 1,
    camera: { worldX: 0, worldY: 0, zoom: 1 },
    frames: [homeFrame()],
    annotations: [],
    units: [],
    zones: [],
    verdicts: [],
    reviewSummaries: [],
  }
}

function questionEvent(id: string, overrides: Partial<Extract<CanvasEvent, { type: 'question' }>> = {}): CanvasEvent {
  return {
    schemaVersion: 1,
    id,
    runId,
    frameId: 'home',
    type: 'question',
    text: `Question ${id}`,
    anchor: [0.5, 0.5],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('canvas event ingest', () => {
  let dataDir: string
  let store: ReturnType<typeof createHostDataStore>
  let boardWrites: ReturnType<typeof createProjectBoardWriteQueue>
  let events: ReturnType<typeof createHostEventBus>
  let published: HostEvent[]
  let boardWriteCount: number

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'canvas-event-ingest-'))
    store = createHostDataStore(dataDir)
    const writeBoard = store.writeBoard.bind(store)
    store.writeBoard = (id, board) => {
      boardWriteCount += 1
      writeBoard(id, board)
    }
    boardWriteCount = 0
    boardWrites = createProjectBoardWriteQueue(store)
    events = createHostEventBus()
    published = []
    events.subscribe((event) => published.push(event))
    store.writeBoard(projectId, sampleBoard())
    boardWriteCount = 0
  })

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true })
  })

  function ingest(event: CanvasEvent) {
    return ingestCanvasEvent({ store, boardWrites, events, projectId, runId, event })
  }

  function sync() {
    return syncCanvasEventsFromFile({ store, boardWrites, events, projectId, runId })
  }

  function journalLines(): string[] {
    const file = canvasEventsPath(store, runId)
    if (!existsSync(file)) return []
    return readFileSync(file, 'utf8').split('\n').filter((line) => line.trim() !== '')
  }

  it('applies a posted event, journals it, and publishes one board-patched', async () => {
    const result = await ingest(questionEvent('q-1'))
    expect(result).toMatchObject({ ok: true, applied: true, appended: true })
    if (!result.ok) return
    expect(result.board.documentRevision).toBe(2)
    expect(result.annotation).toMatchObject({ id: 'q-1', role: 'agent-question', frameId: 'home' })

    expect(journalLines()).toHaveLength(1)
    expect(JSON.parse(journalLines()[0]!)).toMatchObject({ id: 'q-1', runId })
    expect(published).toEqual([expect.objectContaining({ type: 'board-patched', documentRevision: 2, runId })])
  })

  it('does not journal a rejected unknown-frame event', async () => {
    const result = await ingest(questionEvent('q-ghost', { frameId: 'ghost' }))
    expect(result).toEqual({ ok: false, reason: 'unknown-frame' })
    expect(journalLines()).toHaveLength(0)
    // A later sync has nothing to replay: the rejection never reached the file.
    expect(await sync()).toEqual({ applied: [], board: null })
    expect(store.readBoard(projectId)?.documentRevision).toBe(1)
  })

  it('does not journal an event when the project has no board', async () => {
    const result = await ingestCanvasEvent({
      store,
      boardWrites,
      events,
      projectId: 'no-board-project',
      runId,
      event: questionEvent('q-1'),
    })
    expect(result).toEqual({ ok: false, reason: 'no-board' })
    expect(journalLines()).toHaveLength(0)
  })

  it('rejects an event whose runId does not match the run', async () => {
    const result = await ingest(questionEvent('q-1', { runId: 'someone-else' }))
    expect(result).toEqual({ ok: false, reason: 'run-mismatch' })
    expect(journalLines()).toHaveLength(0)
  })

  it('dedupes an already-seen id without a second journal line or revision bump', async () => {
    const first = await ingest(questionEvent('q-1'))
    expect(first).toMatchObject({ ok: true, applied: true, appended: true })

    const second = await ingest(questionEvent('q-1'))
    expect(second).toMatchObject({ ok: true, applied: false, appended: false })
    if (!second.ok) return
    expect(second.board.documentRevision).toBe(2)
    expect(journalLines()).toHaveLength(1)

    // Sync sees the same id in the file and applies nothing new either.
    expect((await sync()).applied).toEqual([])
    expect(store.readBoard(projectId)?.documentRevision).toBe(2)
  })

  it('tolerates corrupt, partial, and invalid-schema jsonl lines during sync', async () => {
    const file = canvasEventsPath(store, runId)
    writeFileSync(file, [
      JSON.stringify(questionEvent('q-valid')),
      '{"broken',
      'not json at all',
      JSON.stringify({ schemaVersion: 1, id: 'q-bad-shape', type: 'question' }),
      '{"id":"trailing-partial"',
    ].join('\n'))

    const result = await sync()
    expect(result.applied.map((annotation) => annotation.id)).toEqual(['q-valid'])
    expect(result.board?.annotations.map((annotation) => annotation.id)).toEqual(['q-valid'])
  })

  it('skips run-mismatch lines during sync', async () => {
    const file = canvasEventsPath(store, runId)
    writeFileSync(file, [
      JSON.stringify(questionEvent('q-mine')),
      JSON.stringify(questionEvent('q-theirs', { runId: 'another-run' })),
    ].join('\n') + '\n')

    const result = await sync()
    expect(result.applied.map((annotation) => annotation.id)).toEqual(['q-mine'])
    expect(result.board?.annotations.some((annotation) => annotation.id === 'q-theirs')).toBe(false)
  })

  it('skips unknown-frame lines during sync but applies the rest', async () => {
    const file = canvasEventsPath(store, runId)
    writeFileSync(file, [
      JSON.stringify(questionEvent('q-known')),
      JSON.stringify(questionEvent('q-unknown', { frameId: 'ghost' })),
    ].join('\n') + '\n')

    const result = await sync()
    expect(result.applied.map((annotation) => annotation.id)).toEqual(['q-known'])
    expect(result.board?.annotations.map((annotation) => annotation.id)).toEqual(['q-known'])
  })

  it('applies a batch of file events with a single board write and one revision bump', async () => {
    const file = canvasEventsPath(store, runId)
    writeFileSync(file, [
      JSON.stringify(questionEvent('q-1')),
      JSON.stringify(questionEvent('q-2')),
      JSON.stringify(questionEvent('q-3')),
    ].join('\n') + '\n')

    const result = await sync()
    expect(result.applied.map((annotation) => annotation.id)).toEqual(['q-1', 'q-2', 'q-3'])
    expect(boardWriteCount).toBe(1)
    expect(result.board?.documentRevision).toBe(2)

    // One board-patched fan-out carries every applied annotation.
    const patches = published.filter((event) => event.type === 'board-patched')
    expect(patches).toHaveLength(1)
    expect(patches[0]).toMatchObject({ documentRevision: 2, runId })
  })
})
