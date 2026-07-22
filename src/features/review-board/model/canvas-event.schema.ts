import { z } from 'zod'
// Explicit .ts extensions keep this module graph loadable by the Node host
// process, which runs TypeScript through native type stripping.
import { AnnotationMarkSchema, NormalizedPointSchema } from './board-document.schema.ts'

export const CANVAS_EVENT_SCHEMA_VERSION = 1 as const

const CanvasEventBaseSchema = z.object({
  schemaVersion: z.literal(CANVAS_EVENT_SCHEMA_VERSION),
  // Stable id: also becomes the board annotation id so apply is idempotent.
  id: z.string().min(1),
  runId: z.string().min(1),
  frameId: z.string().min(1),
  anchor: NormalizedPointSchema,
  createdAt: z.string().datetime(),
})

// An agent question anchored on a frame. Lands as role: 'agent-question'.
export const QuestionCanvasEventSchema = CanvasEventBaseSchema.extend({
  type: z.literal('question'),
  text: z.string().min(1),
  mark: AnnotationMarkSchema.nullable().optional(),
})

// An agent teach answer pinned to a frame. Lands as role: 'teach'.
export const TeachAnswerCanvasEventSchema = CanvasEventBaseSchema.extend({
  type: z.literal('teach-answer'),
  instruction: z.string().min(1),
  mark: AnnotationMarkSchema.nullable().optional(),
  requestId: z.string().min(1).optional(),
})

export const CanvasEventSchema = z.discriminatedUnion('type', [
  QuestionCanvasEventSchema,
  TeachAnswerCanvasEventSchema,
])

export type QuestionCanvasEvent = z.infer<typeof QuestionCanvasEventSchema>
export type TeachAnswerCanvasEvent = z.infer<typeof TeachAnswerCanvasEventSchema>
export type CanvasEvent = z.infer<typeof CanvasEventSchema>
