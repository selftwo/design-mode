import { z } from 'zod'
import type { BoardDocument } from './board-document.schema'
// Explicit .ts extensions keep this module graph loadable by the Node host
// process, which runs TypeScript through native type stripping.
import { isInstructionIncomplete } from './annotation-instruction.ts'
import { AgentAnnotationSchema, exportAgentAnnotation, isAbsoluteScreenshotPath } from './export-agent-annotation.ts'
import { isReviewAnnotation } from '../is-board-annotation.ts'

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

export function collectReviewBatchBlocks(document: BoardDocument): ReviewBatchBlock[] {
  const blocks: ReviewBatchBlock[] = []
  for (const annotation of document.annotations) {
    if (!isReviewAnnotation(annotation)) continue
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

  const reviewAnnotations = document.annotations.filter(isReviewAnnotation)
  const batch = ReviewBatchSchema.parse({
    schemaVersion: REVIEW_BATCH_SCHEMA_VERSION,
    boardId: document.boardId,
    exportedAt,
    annotations: reviewAnnotations.map((annotation) => exportAgentAnnotation(document, annotation.id)),
  })
  return { ok: true, batch }
}
