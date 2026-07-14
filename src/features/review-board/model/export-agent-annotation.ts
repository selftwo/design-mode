import { z } from 'zod'
import { CircleMarkSchema, NormalizedPointSchema, ViewportSchema, type BoardDocument } from './board-document.schema'

export const AgentAnnotationSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  status: z.literal('draft'),
  instruction: z.string(),
  frameId: z.string().min(1),
  route: z.string(),
  viewport: ViewportSchema,
  fullScreenshot: z.string().min(1),
  crop: z.null(),
  elements: z.tuple([]),
  marks: z.array(CircleMarkSchema),
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
    frameId: frame.id,
    route: frame.route,
    viewport: frame.viewport,
    fullScreenshot: frame.screenshotPath,
    crop: null,
    elements: [],
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
