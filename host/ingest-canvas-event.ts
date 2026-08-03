import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { CanvasEventSchema, type CanvasEvent } from '../src/features/review-board/model/canvas-event.schema.ts'
import { applyCanvasEvent, isAgentAuthoredAnnotation } from '../src/features/review-board/model/apply-canvas-event.ts'
import type { BoardDocument, BoardAnnotation, ReviewAnnotation } from '../src/features/review-board/model/board-document.schema.ts'
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

// Append dedupe keeps one id set per run in memory instead of rescanning the
// jsonl (which can hold many lines) on every append. Seeded from the file on
// first use and refreshed by sync, which reads the file anyway; keyed weakly by
// store so a closed host's cache can be collected and test stores stay isolated.
const seenEventIdsByStore = new WeakMap<HostDataStore, Map<string, Set<string>>>()

function seenEventIds(store: HostDataStore, runId: string): Set<string> {
  let byRun = seenEventIdsByStore.get(store)
  if (!byRun) {
    byRun = new Map()
    seenEventIdsByStore.set(store, byRun)
  }
  let ids = byRun.get(runId)
  if (!ids) {
    ids = listCanvasEventIds(store, runId)
    byRun.set(runId, ids)
  }
  return ids
}

// Append one checked event. Returns false when the id is already in the log
// (dedupe), so callers can still apply it idempotently via the board.
export function appendCanvasEvent(store: HostDataStore, event: CanvasEvent): boolean {
  const seen = seenEventIds(store, event.runId)
  if (seen.has(event.id)) return false
  const file = canvasEventsPath(store, event.runId)
  mkdirSync(path.dirname(file), { recursive: true })
  appendFileSync(file, `${JSON.stringify(event)}\n`, 'utf8')
  seen.add(event.id)
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

// Validate → apply through the write queue → append (dedupe) → emit a
// revisioned SSE patch. The board apply comes first so the journal only ever
// records events the board accepted; a rejected event (unknown frame, no board)
// never reaches the jsonl and so can never replay on a later sync. Re-ingesting
// the same event id is safe: the board write is skipped when the annotation
// already exists and jsonl skips the append.
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

  const appended = appendCanvasEvent(store, event)

  const annotation = result.board.annotations.find((item) => item.id === event.id)
  if (!annotation || !isAgentAuthoredAnnotation(annotation)) return { ok: false, reason: 'unknown-frame' }

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
// The whole file lands in one board read/write: board JSON embeds screenshot
// data URLs, so per-line writes would re-parse megabytes per event.
export async function syncCanvasEventsFromFile(input: {
  store: HostDataStore
  boardWrites: ProjectBoardWriteQueue
  events: HostEventBus
  projectId: string
  runId: string
}): Promise<{ applied: ReviewAnnotation[]; board: BoardDocument | null }> {
  const { store, boardWrites, events, projectId, runId } = input
  const fileEvents = readCanvasEvents(store, runId)
  // The file is the source of truth for this run's ids: fold in anything an
  // agent appended directly so the POST dedupe set stays accurate.
  const seen = seenEventIds(store, runId)
  for (const event of fileEvents) seen.add(event.id)

  const pending = fileEvents.filter((event) => event.runId === runId)
  if (pending.length === 0) return { applied: [], board: null }

  let applied: ReviewAnnotation[] = []
  let board: BoardDocument
  try {
    const result = await boardWrites.mutateAndSaveIfChanged(projectId, (latest) => {
      if (!latest) throw new CanvasEventIngestError('no-board')
      applied = []
      let next = latest
      for (const event of pending) {
        const outcome = applyCanvasEvent(next, event)
        // An unknown frame is skipped, not fatal: the line stays in the file for
        // a later sync (agents may write events before the frame is captured).
        if (!outcome.ok) continue
        next = outcome.board
        if (outcome.applied && isAgentAuthoredAnnotation(outcome.annotation)) applied.push(outcome.annotation)
      }
      return { board: next, changed: applied.length > 0 }
    })
    board = result.board
  } catch (error) {
    if (error instanceof CanvasEventIngestError) return { applied: [], board: null }
    throw error
  }

  if (applied.length > 0) {
    events.publish({
      type: 'board-patched',
      projectId,
      documentRevision: board.documentRevision,
      runId,
      records: applied.map((annotation) => ({ kind: 'annotation' as const, annotation })),
    })
  }

  return { applied, board }
}
