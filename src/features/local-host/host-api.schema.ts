import { z } from 'zod'
// Explicit .ts extensions keep this module graph loadable by the Node host
// process, which runs TypeScript through native type stripping.
import { BoardDocumentSchema, NormalizedPointSchema, ReviewAnnotationSchema } from '../review-board/model/board-document.schema.ts'
import { ReviewBatchSchema } from '../review-board/model/review-batch.ts'

export const HOST_API_VERSION = 1 as const

export const AgentIdSchema = z.enum(['claude', 'codex', 'cursor'])

// A route the host should open and capture when it produces a board.
export const ProjectRouteSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  path: z.string().min(1),
  // Optional visible control to click after load, for single-page apps whose
  // screens are not reachable by URL alone.
  click: z.string().min(1).optional(),
})

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  devCommand: z.string().min(1),
  devPort: z.number().int().positive(),
  routes: z.array(ProjectRouteSchema).min(1),
  registeredAt: z.string().datetime(),
})

export const ProjectRegistrationSchema = ProjectSchema.omit({ id: true, registeredAt: true })

export const ProjectListSchema = z.object({ projects: z.array(ProjectSchema) })

export const ContextFileSchema = z.object({
  name: z.string().min(1),
  content: z.string(),
})

export const ProjectContextSchema = z.object({ files: z.array(ContextFileSchema) })

export const AgentAvailabilitySchema = z.object({
  id: AgentIdSchema,
  available: z.boolean(),
})

export const AgentListSchema = z.object({ agents: z.array(AgentAvailabilitySchema) })

export const AgentRunStatusSchema = z.enum(['queued', 'running', 'done', 'failed'])

export const AgentRunSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  agent: AgentIdSchema,
  status: AgentRunStatusSchema,
  annotationIds: z.array(z.string().min(1)),
  // Set only for lo-fi generation runs, which belong to a design unit. Ordinary
  // review dispatch runs leave it unset, so the shared schema keeps it optional.
  unitId: z.string().min(1).optional(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
  // Tail of the agent's output so reviewers can see what a collaborator did.
  outputTail: z.string(),
  error: z.string().optional(),
})

export const RunListSchema = z.object({ runs: z.array(AgentRunSchema) })

export const DispatchRequestSchema = z.object({
  agent: AgentIdSchema,
  batch: ReviewBatchSchema,
})

export const DispatchAcceptedSchema = z.object({ run: AgentRunSchema })

// Ask an agent to generate several standalone lo-fi HTML options for a design
// unit. The agent text is built host-side from the unit's brief and rules, so
// the client sends only the unit id and a count, never free prompt text. Strict,
// so an old `{prompt,count}` client fails fast with a 400 instead of being run.
export const GenerateOptionsRequestSchema = z.object({
  agent: AgentIdSchema,
  unitId: z.string().min(1),
  count: z.number().int().min(1).max(6).default(3),
}).strict()

export const GenerateOptionsAcceptedSchema = z.object({ run: AgentRunSchema })

// Ask an agent to answer a reviewer's question about a screen and pin the answer
// to the canvas as a teach note. The round trip is agent-neutral: the browser
// names the frame, the point to anchor on, the question, and a client request id
// the agent echoes back on its teach-answer event so the answer can be matched to
// this question. Strict, so a stale client shape fails fast with a 400.
export const LearnRequestSchema = z.object({
  agent: AgentIdSchema,
  frameId: z.string().min(1),
  anchor: NormalizedPointSchema,
  question: z.string().min(1),
  requestId: z.string().uuid(),
  // The name of the element the reviewer asked about, when one was picked.
  elementLabel: z.string().min(1).optional(),
}).strict()

export const LearnAcceptedSchema = z.object({ run: AgentRunSchema })

export const BoardResponseSchema = z.object({ board: BoardDocumentSchema })

// Compare-and-save: the client names the revision it last observed; the host
// rejects with 409 when that revision is stale. Board.documentRevision in the
// payload is ignored — the host alone assigns the next revision on success.
export const BoardPutRequestSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  board: BoardDocumentSchema,
})

export const BoardPutSuccessSchema = z.object({
  board: BoardDocumentSchema,
})

export const BoardConflictResponseSchema = z.object({
  error: z.string().min(1),
  documentRevision: z.number().int().positive(),
  board: BoardDocumentSchema,
})

export const LiveSessionResponseSchema = z.object({
  liveUrl: z.string().min(1),
  allowedOrigin: z.string().min(1),
  focusToken: z.string().uuid(),
})

export const CaptureRefreshResponseSchema = z.object({ board: BoardDocumentSchema })

export const HostErrorSchema = z.object({ error: z.string().min(1) })

export const BoardPatchRecordSchema = z.object({
  kind: z.literal('annotation'),
  annotation: ReviewAnnotationSchema,
})

// Server-sent events that make agent activity visible on the board, the way
// collaborator cursors are visible in a multiplayer design tool.
export const HostEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('run-updated'), run: AgentRunSchema }),
  z.object({ type: z.literal('board-updated'), projectId: z.string().min(1) }),
  // Granular agent→canvas write: App merges by record id without a full reload.
  z.object({
    type: z.literal('board-patched'),
    projectId: z.string().min(1),
    documentRevision: z.number().int().positive(),
    runId: z.string().min(1),
    records: z.array(BoardPatchRecordSchema).min(1),
  }),
  z.object({ type: z.literal('capture-started'), projectId: z.string().min(1) }),
  z.object({ type: z.literal('capture-failed'), projectId: z.string().min(1), error: z.string().min(1) }),
])

export type AgentId = z.infer<typeof AgentIdSchema>
export type ProjectRoute = z.infer<typeof ProjectRouteSchema>
export type Project = z.infer<typeof ProjectSchema>
export type ProjectRegistration = z.infer<typeof ProjectRegistrationSchema>
export type ContextFile = z.infer<typeof ContextFileSchema>
export type AgentAvailability = z.infer<typeof AgentAvailabilitySchema>
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>
export type AgentRun = z.infer<typeof AgentRunSchema>
export type DispatchRequest = z.infer<typeof DispatchRequestSchema>
export type GenerateOptionsRequest = z.infer<typeof GenerateOptionsRequestSchema>
export type LearnRequest = z.infer<typeof LearnRequestSchema>
export type HostEvent = z.infer<typeof HostEventSchema>
export type BoardPutRequest = z.infer<typeof BoardPutRequestSchema>
