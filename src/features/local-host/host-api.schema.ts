import { z } from 'zod'
// Explicit .ts extensions keep this module graph loadable by the Node host
// process, which runs TypeScript through native type stripping.
import { BoardDocumentSchema } from '../review-board/model/board-document.schema.ts'
import { ReviewBatchSchema } from '../review-board/model/review-batch.ts'
import { TeachAnswerSchema, TeachQuestionSchema } from '../review-board/model/teach-question.schema.ts'

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

export const BoardResponseSchema = z.object({ board: BoardDocumentSchema })

export const BoardReplyRequestSchema = z.object({
  annotationId: z.string().min(1),
  body: z.string().min(1),
  author: z.string().min(1).optional(),
})

export const BoardResolveRequestSchema = z.object({
  annotationId: z.string().min(1),
})

export const LiveSessionResponseSchema = z.object({
  liveUrl: z.string().min(1),
  allowedOrigin: z.string().min(1),
  focusToken: z.string().uuid(),
})

export const CaptureRefreshResponseSchema = z.object({ board: BoardDocumentSchema })

export const TeachQuestionRequestSchema = z.object({
  question: TeachQuestionSchema,
  agent: AgentIdSchema.optional(),
})

export const TeachQuestionResponseSchema = z.object({
  answer: TeachAnswerSchema,
})

export const HostErrorSchema = z.object({ error: z.string().min(1) })

// Server-sent events that make agent activity visible on the board, the way
// collaborator cursors are visible in a multiplayer design tool.
export const HostEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('run-updated'), run: AgentRunSchema }),
  z.object({ type: z.literal('board-updated'), projectId: z.string().min(1) }),
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
export type HostEvent = z.infer<typeof HostEventSchema>
