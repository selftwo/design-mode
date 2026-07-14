import { z } from 'zod'

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
})

export const CircleMarkSchema = z.object({
  kind: z.literal('circle'),
  points: z.tuple([NormalizedPointSchema, NormalizedPointSchema]),
})

export const ReviewAnnotationSchema = z.object({
  id: z.string().min(1),
  frameId: z.string().min(1),
  status: z.literal('draft'),
  instruction: z.string(),
  anchor: NormalizedPointSchema,
  mark: CircleMarkSchema.nullable(),
  createdAt: z.string().datetime(),
  madeAgainstCaptureHash: z.string().min(1),
  madeAgainstRevision: z.number().int().positive(),
})

export const BoardDocumentSchema = z.object({
  schemaVersion: z.literal(BOARD_SCHEMA_VERSION),
  boardId: z.string().min(1),
  camera: BoardCameraSchema,
  frames: z.array(ScreenFrameSchema),
  annotations: z.array(ReviewAnnotationSchema),
})

export type EngineName = z.infer<typeof EngineNameSchema>
export type ToolMode = z.infer<typeof ToolModeSchema>
export type NormalizedPoint = z.infer<typeof NormalizedPointSchema>
export type BoardCamera = z.infer<typeof BoardCameraSchema>
export type ScreenFrame = z.infer<typeof ScreenFrameSchema>
export type CircleMark = z.infer<typeof CircleMarkSchema>
export type ReviewAnnotation = z.infer<typeof ReviewAnnotationSchema>
export type BoardDocument = z.infer<typeof BoardDocumentSchema>
