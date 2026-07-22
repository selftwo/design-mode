import { z } from 'zod'
import type { BoardDocument } from './board-document.schema'
// Explicit .ts extensions keep this module graph loadable by the Node host
// process, which runs TypeScript through native type stripping.
import { isDispatchableAnnotation } from './apply-canvas-event.ts'
import { isInstructionIncomplete } from './annotation-instruction.ts'
import { AgentAnnotationSchema, exportAgentAnnotation, isAbsoluteScreenshotPath } from './export-agent-annotation.ts'

export const REVIEW_BATCH_SCHEMA_VERSION = 1 as const

export const ReviewBatchSchema = z.object({
  schemaVersion: z.literal(REVIEW_BATCH_SCHEMA_VERSION),
  boardId: z.string().min(1),
  exportedAt: z.string().datetime(),
  annotations: z.array(AgentAnnotationSchema),
})

export type ReviewBatch = z.infer<typeof ReviewBatchSchema>

export type ReviewBatchBlockReason = 'incomplete-instruction' | 'absolute-screenshot-path'

export interface ReviewBatchBlock {
  annotationId: string
  reason: ReviewBatchBlockReason
}

export type ReviewBatchBuildResult =
  | { ok: true; batch: ReviewBatch }
  | { ok: false; blocks: ReviewBatchBlock[] }

function dispatchableAnnotations(document: BoardDocument) {
  // Teach notes and agent questions are inbound from the agent; they never
  // leave as a code-change dispatch batch.
  return document.annotations.filter(isDispatchableAnnotation)
}

export function collectReviewBatchBlocks(document: BoardDocument): ReviewBatchBlock[] {
  const blocks: ReviewBatchBlock[] = []
  for (const annotation of dispatchableAnnotations(document)) {
    if (isInstructionIncomplete(annotation.instruction)) {
      blocks.push({ annotationId: annotation.id, reason: 'incomplete-instruction' })
      continue
    }
    const frame = document.frames.find((item) => item.id === annotation.frameId)
    if (frame && isAbsoluteScreenshotPath(frame.screenshotPath)) {
      blocks.push({ annotationId: annotation.id, reason: 'absolute-screenshot-path' })
    }
  }
  return blocks
}

export function buildReviewBatch(document: BoardDocument, exportedAt: string = new Date().toISOString()): ReviewBatchBuildResult {
  const blocks = collectReviewBatchBlocks(document)
  if (blocks.length > 0) return { ok: false, blocks }

  const batch = ReviewBatchSchema.parse({
    schemaVersion: REVIEW_BATCH_SCHEMA_VERSION,
    boardId: document.boardId,
    exportedAt,
    annotations: dispatchableAnnotations(document).map((annotation) => exportAgentAnnotation(document, annotation.id)),
  })
  return { ok: true, batch }
}
