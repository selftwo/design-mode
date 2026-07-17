import { z } from 'zod'
// The .ts extension keeps this file loadable by the Node host process, which
// runs TypeScript through native type stripping.
import { AnnotationIntentSchema, AnnotationMarkSchema, NormalizedPointSchema, ViewportSchema, type BoardDocument } from './board-document.schema.ts'

export function isAbsoluteScreenshotPath(value: string): boolean {
  return value.startsWith('/') || value.startsWith('\\\\') || /^[a-zA-Z]:[\\/]/.test(value)
}

export const AgentAnnotationSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  status: z.literal('draft'),
  instruction: z.string(),
  intent: AnnotationIntentSchema.optional(),
  frameId: z.string().min(1),
  route: z.string(),
  viewport: ViewportSchema,
  fullScreenshot: z.string().min(1).refine((value) => !isAbsoluteScreenshotPath(value), {
    message: 'Screenshot path must be project relative, not absolute',
  }),
  crop: z.null(),
  elements: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    bounds: z.tuple([NormalizedPointSchema, NormalizedPointSchema]),
  })),
  marks: z.array(AnnotationMarkSchema),
  anchor: NormalizedPointSchema,
  madeAgainst: z.object({
    sha: z.null(),
    timestamp: z.string().datetime(),
    captureHash: z.string().min(1),
    revision: z.number().int().positive(),
  }),
})

export type AgentAnnotation = z.infer<typeof AgentAnnotationSchema>

export function exportAgentAnnotation(document: BoardDocument, annotationId: string): AgentAnnotation {
  const annotation = document.annotations.find((item) => item.id === annotationId)
  if (!annotation) throw new Error(`Unknown annotation: ${annotationId}`)
  const frame = document.frames.find((item) => item.id === annotation.frameId)
  if (!frame) throw new Error(`Unknown frame: ${annotation.frameId}`)
  return AgentAnnotationSchema.parse({
    schemaVersion: 1,
    id: annotation.id,
    status: annotation.status,
    instruction: annotation.instruction,
    intent: annotation.intent,
    frameId: frame.id,
    route: frame.route,
    viewport: frame.viewport,
    fullScreenshot: frame.screenshotPath,
    crop: null,
    elements: annotation.mark?.kind === 'element'
      ? [{ id: annotation.mark.elementId, label: annotation.mark.label, bounds: annotation.mark.points }]
      : [],
    marks: annotation.mark ? [annotation.mark] : [],
    anchor: annotation.anchor,
    madeAgainst: {
      sha: null,
      timestamp: annotation.createdAt,
      captureHash: annotation.madeAgainstCaptureHash,
      revision: annotation.madeAgainstRevision,
    },
  })
}
