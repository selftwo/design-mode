import { z } from 'zod'
import { addBoardRelationIssues } from './board-relations'
import { ElementAspectsSchema } from './element-aspects.schema'
import { ThreadReplySchema } from './thread-reply.schema'

export const BOARD_SCHEMA_VERSION = 2 as const

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

// What a frame's pixels are and how they behave on the board:
//  - captured-route: a real app route the host captured
//  - imported-image: a raster file a reviewer dropped in
//  - reference-image: a dropped image pinned as research for a unit's decision
//  - option-snapshot: a generated lo-fi option kept as a still image
//  - playable-option: a generated lo-fi option mounted as a live iframe
export const FrameKindSchema = z.enum([
  'captured-route',
  'imported-image',
  'reference-image',
  'option-snapshot',
  'playable-option',
])

// Where a frame sits in the decision lifecycle. Only option frames move past
// 'active': a promoted winner locks, its siblings archive, a struck option is
// killed. Captured routes and uploads stay 'active'.
export const FrameLifeStateSchema = z.enum(['active', 'locked', 'archived', 'killed'])

// A durable, origin-free locator for a playable option's scratch HTML. The
// host derives the transient token, port, and origin at mount time; only the
// stable path, protocol, and artifact hash are persisted.
const SCRATCH_HTML_PATH = /^\/scratch\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/option-\d+\.html$/
export const LiveSourceSchema = z.object({
  kind: z.literal('scratch-html'),
  path: z
    .string()
    .regex(SCRATCH_HTML_PATH, 'liveSource.path must be /scratch/<project>/<set>/option-N.html')
    .refine((value) => !value.includes('..'), 'liveSource.path must not contain ".."'),
  protocolVersion: z.literal(1),
  artifactHash: z.string().regex(/^[0-9a-f]{64}$/, 'artifactHash must be a lowercase sha-256 hex digest'),
})

const ControlIdSchema = z.string().min(1).max(64).regex(/^[a-z][a-z0-9-]*$/)
const ChoiceValueSchema = z.string().min(1).max(64).regex(/^[a-z][a-z0-9-]*$/)
const ControlLabelSchema = z.string().min(1).max(120)

export const KitToggleControlSchema = z.object({
  kind: z.literal('toggle'),
  id: ControlIdSchema,
  label: ControlLabelSchema,
  default: z.boolean(),
})

export const KitChoiceOptionSchema = z.object({
  value: ChoiceValueSchema,
  label: ControlLabelSchema,
})

export const KitChoiceControlSchema = z.object({
  kind: z.literal('choice'),
  id: ControlIdSchema,
  label: ControlLabelSchema,
  options: z.array(KitChoiceOptionSchema).min(1).max(32),
  default: ChoiceValueSchema,
})

export const KitControlSchema = z.discriminatedUnion('kind', [
  KitToggleControlSchema,
  KitChoiceControlSchema,
])

// The set of dials the agent shipped for one option. The manifest is fixed for
// the life of the artifact; only `state` changes as the reviewer plays with it.
export const KitManifestSchema = z.object({
  manifestVersion: z.literal(1),
  controls: z.array(KitControlSchema).min(1).max(32),
})

export const KitStateValueSchema = z.union([z.boolean(), z.string().max(64)])

export const FrameKitSchema = z.object({
  manifest: KitManifestSchema,
  state: z.record(KitStateValueSchema),
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
  kind: FrameKindSchema,
  lifeState: FrameLifeStateSchema,
  // Which design unit owns this frame. Option frames always have one; captured
  // routes and uploads do not.
  unitId: z.string().min(1).optional(),
  // Which greyed zone the frame currently sits inside, once archived or killed.
  zoneId: z.string().min(1).optional(),
  // Present only on playable options: the scratch HTML the iframe mounts.
  liveSource: LiveSourceSchema.optional(),
  // Present only on option frames that ship a control kit.
  kit: FrameKitSchema.optional(),
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

// Who authored the annotation and how it behaves:
//  - review: human review mark; may export into a dispatch batch
//  - agent-question: agent asking the reviewer (item 4b); never dispatches
//  - teach: agent-voiced explanation pinned to the canvas; never dispatches
export const AnnotationRoleSchema = z.enum(['review', 'agent-question', 'teach'])

export const ReviewAnnotationSchema = z.object({
  kind: z.literal('review'),
  id: z.string().min(1),
  frameId: z.string().min(1),
  // Defaulted so boards written before item 4b keep parsing without a bump.
  role: AnnotationRoleSchema.default('review'),
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
  // Present on agent-authored rows from the canvas-events back-channel.
  runId: z.string().min(1).optional(),
  canvasEventId: z.string().min(1).optional(),
  // Reserved for the learn-lens round trip (item 4d); optional in 4b.
  requestId: z.string().min(1).optional(),
})

// A single decision the reviewer is working: a brief, its rules, and the
// dependency and lock state that gate when its options may be generated.
export const DesignUnitSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  brief: z.string(),
  rules: z.array(z.string()),
  dependsOnUnitIds: z.array(z.string().min(1)),
  state: z.enum(['open', 'locked']),
  // A leading candidate the reviewer marked but has not confirmed. Never a lock.
  nomineeFrameId: z.string().min(1).optional(),
  // The confirmed winner, set only when the unit is locked.
  lockedFrameId: z.string().min(1).optional(),
})

// A greyed drop area behind the frames of one unit, holding archived losers or
// killed options. Placement lands in a later work item; the shape lands now.
export const BoardZoneSchema = z.object({
  id: z.string().min(1),
  unitId: z.string().min(1),
  kind: z.enum(['archive', 'killed']),
  label: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().finite(),
  height: z.number().positive().finite(),
  collapsed: z.boolean(),
})

// One confirmed verdict, appended to the ledger: promote locks a unit, kill
// strikes an option. Carries the kit snapshot the decision was made against.
export const UnitVerdictSchema = z.object({
  id: z.string().min(1),
  unitId: z.string().min(1),
  frameId: z.string().min(1),
  kind: z.enum(['promote', 'kill']),
  summary: z.string(),
  createdAt: z.string().datetime(),
  kitSnapshot: z.record(KitStateValueSchema).nullable(),
  // The reference frames this decision was made against, captured at confirm
  // time. Deliberately not checked against the board's frames: deleting a
  // reference later must never rewrite a past verdict, so a dangling id is kept
  // and shown as "reference missing". Defaulted so pre-item-5 boards keep parsing.
  referenceFrameIds: z.array(z.string().min(1)).default([]),
})

// A durable per-frame review trace: how long the frame was looked at (rounded
// whole seconds), how many distinct kit states were tried, and whether it was
// played live. Totals only, never an event log. Surfaced as "reviewed" plus
// these numbers, and fed to later prompts. Defaulted so pre-item-6 boards parse.
export const ReviewSummarySchema = z.object({
  frameId: z.string().min(1),
  visibleSeconds: z.number().int().nonnegative(),
  kitStatesTried: z.number().int().nonnegative(),
  playedLive: z.boolean(),
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

const BoardDocumentObjectSchema = z.object({
  schemaVersion: z.literal(BOARD_SCHEMA_VERSION),
  boardId: z.string().min(1),
  // Host-owned optimistic-lock counter for whole-document compare-and-save.
  // Distinct from per-frame capture `revision`. Clients never invent this;
  // the host bumps it on every successful board write.
  documentRevision: z.number().int().positive(),
  camera: BoardCameraSchema,
  frames: z.array(ScreenFrameSchema),
  annotations: z.array(BoardAnnotationSchema),
  units: z.array(DesignUnitSchema),
  zones: z.array(BoardZoneSchema),
  verdicts: z.array(UnitVerdictSchema),
  // Per-frame review traces, one row per frame at most. Defaulted so boards
  // written before item 6 keep parsing without a schema bump.
  reviewSummaries: z.array(ReviewSummarySchema).default([]),
})

export type BoardDocument = z.infer<typeof BoardDocumentObjectSchema>

// The public board schema runs cross-record link checks after the field-level
// shape passes, so a validated board is always internally consistent.
export const BoardDocumentSchema = BoardDocumentObjectSchema.superRefine((document, context) => {
  addBoardRelationIssues(document, context)
})

export type EngineName = z.infer<typeof EngineNameSchema>
export type ToolMode = z.infer<typeof ToolModeSchema>
export type NormalizedPoint = z.infer<typeof NormalizedPointSchema>
export type BoardCamera = z.infer<typeof BoardCameraSchema>
export type FrameElement = z.infer<typeof FrameElementSchema>
export type FrameKind = z.infer<typeof FrameKindSchema>
export type FrameLifeState = z.infer<typeof FrameLifeStateSchema>
export type LiveSource = z.infer<typeof LiveSourceSchema>
export type KitControl = z.infer<typeof KitControlSchema>
export type KitManifest = z.infer<typeof KitManifestSchema>
export type KitStateValue = z.infer<typeof KitStateValueSchema>
export type FrameKit = z.infer<typeof FrameKitSchema>
export type ScreenFrame = z.infer<typeof ScreenFrameSchema>
export type DesignUnit = z.infer<typeof DesignUnitSchema>
export type BoardZone = z.infer<typeof BoardZoneSchema>
export type UnitVerdict = z.infer<typeof UnitVerdictSchema>
export type ReviewSummary = z.infer<typeof ReviewSummarySchema>
export type AnnotationIntent = z.infer<typeof AnnotationIntentSchema>
export type AnnotationRole = z.infer<typeof AnnotationRoleSchema>
export type CircleMark = z.infer<typeof CircleMarkSchema>
export type PathMark = z.infer<typeof PathMarkSchema>
export type ElementMark = z.infer<typeof ElementMarkSchema>
export type AnnotationMark = z.infer<typeof AnnotationMarkSchema>
export type ReviewAnnotation = z.infer<typeof ReviewAnnotationSchema>
export type TeachAnnotation = z.infer<typeof TeachAnnotationSchema>
export type BoardAnnotation = z.infer<typeof BoardAnnotationSchema>
