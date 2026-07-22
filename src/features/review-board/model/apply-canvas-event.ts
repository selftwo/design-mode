import {
  BoardDocumentSchema,
  type BoardDocument,
  type ReviewAnnotation,
} from './board-document.schema.ts'
import type { CanvasEvent } from './canvas-event.schema.ts'

export type ApplyCanvasEventResult =
  | { ok: true; board: BoardDocument; annotation: ReviewAnnotation; applied: boolean }
  | { ok: false; reason: 'unknown-frame' }

// Turns one checked canvas event into a board annotation. The event id is the
// annotation id, so re-applying the same event is a no-op (dedupe).
export function applyCanvasEvent(board: BoardDocument, event: CanvasEvent): ApplyCanvasEventResult {
  const frame = board.frames.find((item) => item.id === event.frameId)
  if (!frame) return { ok: false, reason: 'unknown-frame' }

  const existing = board.annotations.find((item) => item.id === event.id)
  if (existing) {
    return { ok: true, board, annotation: existing, applied: false }
  }

  const annotation = annotationFromCanvasEvent(event, frame.captureHash, frame.revision)
  const next = BoardDocumentSchema.parse({
    ...board,
    annotations: [...board.annotations, annotation],
  })
  return { ok: true, board: next, annotation, applied: true }
}

export function annotationFromCanvasEvent(
  event: CanvasEvent,
  captureHash: string,
  revision: number,
): ReviewAnnotation {
  if (event.type === 'question') {
    return {
      id: event.id,
      frameId: event.frameId,
      role: 'agent-question',
      status: 'draft',
      instruction: event.text,
      anchor: event.anchor,
      mark: event.mark ?? null,
      createdAt: event.createdAt,
      madeAgainstCaptureHash: captureHash,
      madeAgainstRevision: revision,
      runId: event.runId,
      canvasEventId: event.id,
    }
  }

  return {
    id: event.id,
    frameId: event.frameId,
    role: 'teach',
    status: 'draft',
    instruction: event.instruction,
    anchor: event.anchor,
    mark: event.mark ?? null,
    createdAt: event.createdAt,
    madeAgainstCaptureHash: captureHash,
    madeAgainstRevision: revision,
    runId: event.runId,
    canvasEventId: event.id,
    requestId: event.requestId,
  }
}

export function isAgentAuthoredAnnotation(annotation: ReviewAnnotation): boolean {
  return annotation.role === 'agent-question' || annotation.role === 'teach'
}

export function isDispatchableAnnotation(annotation: ReviewAnnotation): boolean {
  return annotation.role === 'review'
}
