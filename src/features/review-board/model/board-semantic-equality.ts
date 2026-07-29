import type { BoardDocument } from './board-document.schema'
import { BoardDocumentSchema } from './board-document.schema'

// Ignores fields that change without the reviewer doing anything:
// documentRevision (the host bumps it on every write) and reviewSummaries
// (the telemetry heartbeat rewrites dwell totals every few seconds). Comparing
// either would keep the board permanently "dirty".
//
// The schema parse normalizes key order: locally created records are object
// literals while host-loaded ones come out of Zod, and JSON.stringify is order
// sensitive. A document that fails the parse (e.g. a host patch raced a reload)
// is compared as-is rather than thrown on; equality checks run inside render.
//
// Documents are updated immutably, so one object always serializes to one
// string; the WeakMap makes repeated checks against the same object free.
const serializedByDocument = new WeakMap<BoardDocument, string>()

function serializeBoardSemantic(document: BoardDocument): string {
  const cached = serializedByDocument.get(document)
  if (cached !== undefined) return cached
  let normalized: BoardDocument = document
  try {
    normalized = BoardDocumentSchema.parse(document)
  } catch {
    // Keep the unparseable document comparable instead of crashing the caller.
  }
  const { documentRevision: _revision, reviewSummaries: _summaries, ...semantic } = normalized
  const text = JSON.stringify(semantic)
  serializedByDocument.set(document, text)
  return text
}

export function boardsSemanticallyEqual(left: BoardDocument, right: BoardDocument): boolean {
  if (left === right) return true
  return serializeBoardSemantic(left) === serializeBoardSemantic(right)
}
