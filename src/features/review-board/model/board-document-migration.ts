import { z } from 'zod'
import {
  BoardCameraSchema,
  BoardDocumentSchema,
  FrameElementSchema,
  ReviewAnnotationSchema,
  ViewportSchema,
  type BoardDocument,
  type DesignUnit,
  type ScreenFrame,
} from './board-document.schema'

// The exact v1 board shape, kept private to this file. It is the only place
// that still knows the old `source`, `optionSetId`, and `preferred` fields, so
// the rest of the app reads v2 alone.

const LegacyFrameSourceSchema = z.enum(['captured-route', 'lofi-option'])

const LegacyScreenFrameSchema = z.object({
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
  source: LegacyFrameSourceSchema.default('captured-route'),
  optionSetId: z.string().min(1).optional(),
  preferred: z.boolean().optional(),
})

// v1 boards never stored `kind` / `role`. Prefill them before the current
// ReviewAnnotationSchema validates, so local storage from the prototype still loads.
const LegacyReviewAnnotationSchema = z.preprocess((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  return {
    ...record,
    kind: 'review',
    role: record.role ?? 'review',
  }
}, ReviewAnnotationSchema)

const LegacyBoardDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  boardId: z.string().min(1),
  camera: BoardCameraSchema,
  frames: z.array(LegacyScreenFrameSchema),
  annotations: z.array(LegacyReviewAnnotationSchema),
})

export type LegacyBoardDocumentV1 = z.infer<typeof LegacyBoardDocumentSchema>
type LegacyScreenFrame = z.infer<typeof LegacyScreenFrameSchema>

function migrateFrameKind(frame: LegacyScreenFrame): ScreenFrame['kind'] {
  if (frame.source === 'lofi-option') return 'option-snapshot'
  if (frame.route.startsWith('uploaded:')) return 'imported-image'
  return 'captured-route'
}

// Turns a validated v1 board into a v2 board object. Old lo-fi options become
// non-playable option snapshots grouped under one unit per option set; an old
// `preferred` flag becomes a unit nominee, never a confirmed lock.
//
// v1 never enforced the v2 relation rules, so this migration salvages instead
// of failing: duplicate frame and annotation ids keep the first occurrence, and
// annotations pointing at a missing frame are dropped. Throwing here would make
// the storage load path discard every local v1 edit over one bad record.
export function migrateBoardDocumentV1(input: LegacyBoardDocumentV1): BoardDocument {
  const units: DesignUnit[] = []
  const unitByGroup = new Map<string, DesignUnit>()
  const usedUnitIds = new Set<string>()

  const seenFrameIds = new Set<string>()
  const sourceFrames = input.frames.filter((frame) => {
    if (seenFrameIds.has(frame.id)) return false
    seenFrameIds.add(frame.id)
    return true
  })

  const seenAnnotationIds = new Set<string>()
  const annotations = input.annotations.filter((annotation) => {
    if (!seenFrameIds.has(annotation.frameId)) return false
    if (seenAnnotationIds.has(annotation.id)) return false
    seenAnnotationIds.add(annotation.id)
    return true
  })

  const uniqueUnitId = (base: string): string => {
    let id = base
    let suffix = 2
    while (usedUnitIds.has(id)) {
      id = `${base}-${suffix}`
      suffix += 1
    }
    usedUnitIds.add(id)
    return id
  }

  const frames: ScreenFrame[] = sourceFrames.map((frame) => {
    const kind = migrateFrameKind(frame)
    const base: ScreenFrame = {
      id: frame.id,
      label: frame.label,
      route: frame.route,
      viewport: frame.viewport,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      aspectRatio: frame.aspectRatio,
      screenshotPath: frame.screenshotPath,
      screenshotDataUrl: frame.screenshotDataUrl,
      refreshedScreenshotDataUrl: frame.refreshedScreenshotDataUrl,
      captureHash: frame.captureHash,
      revision: frame.revision,
      elements: frame.elements,
      kind,
      lifeState: 'active',
    }
    if (kind !== 'option-snapshot') return base

    const groupKey = frame.optionSetId ?? `__frame__${frame.id}`
    let unit = unitByGroup.get(groupKey)
    if (!unit) {
      const unitId = uniqueUnitId(frame.optionSetId ?? `legacy-unit-${frame.id}`)
      unit = {
        id: unitId,
        label: frame.optionSetId ? `Legacy options: ${frame.optionSetId}` : `Legacy option: ${frame.label}`,
        brief: 'Migrated lo-fi option set',
        rules: [],
        dependsOnUnitIds: [],
        state: 'open',
      }
      unitByGroup.set(groupKey, unit)
      units.push(unit)
    }
    if (frame.preferred && !unit.nomineeFrameId) unit.nomineeFrameId = frame.id
    return { ...base, unitId: unit.id }
  })

  return {
    schemaVersion: 2,
    boardId: input.boardId,
    documentRevision: 1,
    camera: input.camera,
    frames,
    annotations,
    units,
    zones: [],
    verdicts: [],
    reviewSummaries: [],
  }
}

function schemaVersionOf(input: unknown): unknown {
  return input && typeof input === 'object' && 'schemaVersion' in input
    ? (input as { schemaVersion: unknown }).schemaVersion
    : undefined
}

// Boards written before item 4a have no documentRevision. Treat them as
// revision 1 so parse stays forward-compatible without a schemaVersion bump.
// Only an absent field is defaulted: a present but wrong-typed value must fail
// validation instead of silently regressing the optimistic-lock counter.
function withDefaultDocumentRevision(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input
  const record = input as Record<string, unknown>
  if (record.documentRevision !== undefined) return input
  return { ...record, documentRevision: 1 }
}

function unsupportedVersionError(version: unknown): z.ZodError {
  return new z.ZodError([
    {
      code: z.ZodIssueCode.custom,
      path: ['schemaVersion'],
      message: `Unsupported board schema version ${String(version)}. This app supports versions 1 and 2.`,
    },
  ])
}

// The single entry point for reading a board from any durable source. It
// accepts v1 or v2 input and always returns a validated v2 board.
export function parseBoardDocument(input: unknown): BoardDocument {
  const version = schemaVersionOf(input)
  if (version === 2) return BoardDocumentSchema.parse(withDefaultDocumentRevision(input))
  if (version === 1) {
    const legacy = LegacyBoardDocumentSchema.parse(input)
    return BoardDocumentSchema.parse(migrateBoardDocumentV1(legacy))
  }
  throw unsupportedVersionError(version)
}

export function safeParseBoardDocument(input: unknown): z.SafeParseReturnType<unknown, BoardDocument> {
  try {
    return { success: true, data: parseBoardDocument(input) }
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, error }
    throw error
  }
}
