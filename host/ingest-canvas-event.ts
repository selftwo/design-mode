import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { CanvasEventSchema, type CanvasEvent } from '../src/features/review-board/model/canvas-event.schema.ts'
import { applyCanvasEvent } from '../src/features/review-board/model/apply-canvas-event.ts'
import type { BoardDocument, ReviewAnnotation } from '../src/features/review-board/model/board-document.schema.ts'
import type { HostDataStore } from './host-data-store.ts'
import type { HostEventBus } from './host-event-bus.ts'
import type { ProjectBoardWriteQueue } from './project-board-write-queue.ts'

export function canvasEventsPath(store: HostDataStore, runId: string): string {
  return path.join(store.runAssetDir(runId), 'canvas-events.jsonl')
}

// Reads every valid line from the run's append-only event log. Blank lines and
// trailing partial lines are ignored so a crash mid-append cannot poison the log.
export function readCanvasEvents(store: HostDataStore, runId: string): CanvasEvent[] {
  const file = canvasEventsPath(store, runId)
  if (!existsSync(file)) return []
  const events: CanvasEvent[] = []
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let raw: unknown
    try {
      raw = JSON.parse(trimmed)
    } catch {
      continue
    }
    const parsed = CanvasEventSchema.safeParse(raw)
    if (parsed.success) events.push(parsed.data)
  }
  return events
}

export function listCanvasEventIds(store: HostDataStore, runId: string): Set<string> {
  return new Set(readCanvasEvents(store, runId).map((event) => event.id))
}

// Append one checked event. Returns false when the id is already in the log
// (dedupe), so callers can still apply it idempotently via the board.
export function appendCanvasEvent(store: HostDataStore, event: CanvasEvent): boolean {
  const existing = listCanvasEventIds(store, event.runId)
  if (existing.has(event.id)) return false
  const file = canvasEventsPath(store, event.runId)
  mkdirSync(path.dirname(file), { recursive: true })
  appendFileSync(file, `${JSON.stringify(event)}\n`, 'utf8')
  return true
}

class CanvasEventIngestError extends Error {
  readonly reason: 'no-board' | 'unknown-frame'

  constructor(reason: 'no-board' | 'unknown-frame') {
    super(`Canvas event rejected: ${reason}`)
    this.name = 'CanvasEventIngestError'
    this.reason = reason
  }
}

export type IngestCanvasEventResult =
  | {
      ok: true
      board: BoardDocument
      annotation: ReviewAnnotation
      applied: boolean
      appended: boolean
    }
  | { ok: false; reason: 'unknown-frame' | 'run-mismatch' | 'no-board' }

// Validate → append (dedupe) → apply through the write queue → emit a revisioned
// SSE patch. Re-ingesting the same event id is safe: jsonl skips the append and
// the board write is skipped when the annotation already exists.
export async function ingestCanvasEvent(input: {
  store: HostDataStore
  boardWrites: ProjectBoardWriteQueue
  events: HostEventBus
  projectId: string
  runId: string
  event: CanvasEvent
}): Promise<IngestCanvasEventResult> {
  const { store, boardWrites, events, projectId, runId, event } = input
  if (event.runId !== runId) return { ok: false, reason: 'run-mismatch' }

  const appended = appendCanvasEvent(store, event)

  let result: { board: BoardDocument; changed: boolean }
  try {
    result = await boardWrites.mutateAndSaveIfChanged(projectId, (latest) => {
      if (!latest) throw new CanvasEventIngestError('no-board')
      const applied = applyCanvasEvent(latest, event)
      if (!applied.ok) throw new CanvasEventIngestError('unknown-frame')
      return { board: applied.board, changed: applied.applied }
    })
  } catch (error) {
    if (error instanceof CanvasEventIngestError) return { ok: false, reason: error.reason }
    throw error
  }

  const annotation = result.board.annotations.find((item) => item.id === event.id)
  if (!annotation) return { ok: false, reason: 'unknown-frame' }

  if (result.changed) {
    events.publish({
      type: 'board-patched',
      projectId,
      documentRevision: result.board.documentRevision,
      runId,
      records: [{ kind: 'annotation', annotation }],
    })
  }

  return {
    ok: true,
    board: result.board,
    annotation,
    applied: result.changed,
    appended,
  }
}

// Apply every jsonl line not yet present on the board. Used when an agent
// appends events to the file directly (no POST), and at the end of a run.
export async function syncCanvasEventsFromFile(input: {
  store: HostDataStore
  boardWrites: ProjectBoardWriteQueue
  events: HostEventBus
  projectId: string
  runId: string
}): Promise<{ applied: ReviewAnnotation[]; board: BoardDocument | null }> {
  const fileEvents = readCanvasEvents(input.store, input.runId)
  if (fileEvents.length === 0) return { applied: [], board: null }

  const applied: ReviewAnnotation[] = []
  let board: BoardDocument | null = null

  for (const event of fileEvents) {
    const result = await ingestCanvasEvent({ ...input, event })
    if (!result.ok) continue
    board = result.board
    if (result.applied) applied.push(result.annotation)
  }

  return { applied, board }
}
