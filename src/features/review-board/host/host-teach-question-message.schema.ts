import { z } from 'zod'
import { TeachAnswerSchema, TeachQuestionSchema } from '../model/teach-question.schema'

export const HOST_TEACH_MESSAGE_VERSION = 1 as const

export const HOST_TEACH_QUESTION_TYPE = 'design-review/ask-teach-question' as const
export const HOST_TEACH_ANSWER_TYPE = 'design-review/teach-answer' as const
export const HOST_TEACH_FAILED_TYPE = 'design-review/teach-question-failed' as const

export const HostTeachQuestionRequestSchema = z.object({
  type: z.literal(HOST_TEACH_QUESTION_TYPE),
  schemaVersion: z.literal(HOST_TEACH_MESSAGE_VERSION),
  requestId: z.string().uuid(),
  question: TeachQuestionSchema,
})

export const HostTeachAnswerSchema = z.object({
  type: z.literal(HOST_TEACH_ANSWER_TYPE),
  schemaVersion: z.literal(HOST_TEACH_MESSAGE_VERSION),
  requestId: z.string().uuid(),
  answer: TeachAnswerSchema,
})

export const HostTeachFailedSchema = z.object({
  type: z.literal(HOST_TEACH_FAILED_TYPE),
  schemaVersion: z.literal(HOST_TEACH_MESSAGE_VERSION),
  requestId: z.string().uuid(),
  error: z.string().min(1),
})

export type HostTeachQuestionResult =
  | { status: 'answered'; requestId: string; answer: z.infer<typeof TeachAnswerSchema> }
  | { status: 'failed'; requestId: string; error: string }
  | { status: 'ignored' }

export function readHostTeachQuestionMessage(value: unknown): HostTeachQuestionResult {
  if (!value || typeof value !== 'object' || !('type' in value)) return { status: 'ignored' }
  const type = value.type
  if (type === HOST_TEACH_FAILED_TYPE) {
    const parsed = HostTeachFailedSchema.safeParse(value)
    if (!parsed.success) return { status: 'ignored' }
    return { status: 'failed', requestId: parsed.data.requestId, error: parsed.data.error }
  }
  if (type !== HOST_TEACH_ANSWER_TYPE) return { status: 'ignored' }
  const parsed = HostTeachAnswerSchema.safeParse(value)
  if (!parsed.success) return { status: 'ignored' }
  return { status: 'answered', requestId: parsed.data.requestId, answer: parsed.data.answer }
}
