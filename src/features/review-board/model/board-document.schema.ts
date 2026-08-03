import { z } from 'zod'
import { ElementAspectsSchema } from './element-aspects.schema'
import { ThreadReplySchema } from './thread-reply.schema'

export const BOARD_SCHEMA_VERSION = 1 as const

export const EngineNameSchema = z.enum(['reactflow', 'excalidraw'])
export const ToolModeSchema = z.enum(['select', 'circle', 'comment'])
export const NormalizedPointSchema = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1),
])

export const BoardCameraSchema = z.object({
  worldX: z.number().finite(),
  worldY: z.number().finite(),
  zoom: z.number().positive().finite(),
})

export const ViewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

// A design element the host extracted from the live page at capture time,
// so the canvas can break the screenshot into selectable components.
export const FrameElementSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  role: z.string().min(1),
  bounds: z.tuple([NormalizedPointSchema, NormalizedPointSchema]),
  aspects: ElementAspectsSchema.optional(),
})

export const ScreenFrameSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  route: z.string(),
  viewport: ViewportSchema,
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().finite(),
  height: z.number().positive().finite(),
  aspectRatio: z.number().positive().finite(),
  screenshotPath: z.string().min(1),
  screenshotDataUrl: z.string().min(1),
  refreshedScreenshotDataUrl: z.string().min(1),
  captureHash: z.string().min(1),
  revision: z.number().int().positive(),
  elements: z.array(FrameElementSchema).default([]),
})

export const CircleMarkSchema = z.object({
  kind: z.literal('circle'),
  points: z.tuple([NormalizedPointSchema, NormalizedPointSchema]),
})

// Freehand ink: the simplified pointer path exactly as the reviewer drew it.
export const PathMarkSchema = z.object({
  kind: z.literal('path'),
  points: z.array(NormalizedPointSchema).min(2).max(256),
})

// A picked design element: points are its bounds inside the frame.
export const ElementMarkSchema = z.object({
  kind: z.literal('element'),
  elementId: z.string().min(1),
  label: z.string().min(1),
  points: z.tuple([NormalizedPointSchema, NormalizedPointSchema]),
})

export const AnnotationMarkSchema = z.discriminatedUnion('kind', [
  CircleMarkSchema,
  PathMarkSchema,
  ElementMarkSchema,
])

// A named design direction for the annotated area, borrowed from Impeccable's
// command vocabulary, so a comment can carry intent an agent can act on
// alongside the written instruction.
export const AnnotationIntentSchema = z.enum([
  'bolder',
  'quieter',
  'distill',
  'typeset',
  'layout',
  'colorize',
  'animate',
  'delight',
  'clarify',
  'harden',
])

export const ReviewAnnotationSchema = z.object({
  kind: z.literal('review'),
  id: z.string().min(1),
  frameId: z.string().min(1),
  status: z.literal('draft'),
  instruction: z.string(),
  intent: AnnotationIntentSchema.optional(),
  anchor: NormalizedPointSchema,
  mark: AnnotationMarkSchema.nullable(),
  replies: z.array(ThreadReplySchema).optional(),
  resolvedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  madeAgainstCaptureHash: z.string().min(1),
  madeAgainstRevision: z.number().int().positive(),
})

export const TeachAnnotationSchema = z.object({
  kind: z.literal('teach'),
  id: z.string().min(1),
  frameId: z.string().min(1),
  status: z.literal('draft'),
  instruction: z.string().min(1),
  question: z.string().min(1),
  provenanceRunId: z.string().min(1),
  anchor: NormalizedPointSchema,
  mark: ElementMarkSchema,
  resolvedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  madeAgainstCaptureHash: z.string().min(1),
  madeAgainstRevision: z.number().int().positive(),
})

function migrateBoardAnnotation(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  if (!('kind' in value)) return { ...value, kind: 'review' }
  return value
}

export const BoardAnnotationSchema = z.preprocess(
  migrateBoardAnnotation,
  z.discriminatedUnion('kind', [ReviewAnnotationSchema, TeachAnnotationSchema]),
)

export const BoardDocumentSchema = z.object({
  schemaVersion: z.literal(BOARD_SCHEMA_VERSION),
  boardId: z.string().min(1),
  camera: BoardCameraSchema,
  frames: z.array(ScreenFrameSchema),
  annotations: z.array(BoardAnnotationSchema),
})

export type EngineName = z.infer<typeof EngineNameSchema>
export type ToolMode = z.infer<typeof ToolModeSchema>
export type NormalizedPoint = z.infer<typeof NormalizedPointSchema>
export type BoardCamera = z.infer<typeof BoardCameraSchema>
export type FrameElement = z.infer<typeof FrameElementSchema>
export type ScreenFrame = z.infer<typeof ScreenFrameSchema>
export type AnnotationIntent = z.infer<typeof AnnotationIntentSchema>
export type CircleMark = z.infer<typeof CircleMarkSchema>
export type PathMark = z.infer<typeof PathMarkSchema>
export type ElementMark = z.infer<typeof ElementMarkSchema>
export type AnnotationMark = z.infer<typeof AnnotationMarkSchema>
export type ReviewAnnotation = z.infer<typeof ReviewAnnotationSchema>
export type TeachAnnotation = z.infer<typeof TeachAnnotationSchema>
export type BoardAnnotation = z.infer<typeof BoardAnnotationSchema>
export type BoardDocument = z.infer<typeof BoardDocumentSchema>
