import { z } from 'zod'
import { NormalizedPointSchema, ViewportSchema } from './board-document.schema'

export const TEACH_QUESTION_SCHEMA_VERSION = 1 as const

export const TeachQuestionElementSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  role: z.string().min(1),
  bounds: z.tuple([NormalizedPointSchema, NormalizedPointSchema]),
})

export const TeachQuestionSchema = z.object({
  schemaVersion: z.literal(TEACH_QUESTION_SCHEMA_VERSION),
  frameId: z.string().min(1),
  route: z.string(),
  viewport: ViewportSchema,
  element: TeachQuestionElementSchema,
  anatomy: z.string().min(1),
  vocabularyTerm: z.string().min(1),
  whyLine: z.string().min(1),
  question: z.string().min(1),
})

export const TeachAnswerSchema = z.object({
  answer: z.string().min(1),
  runId: z.string().min(1),
})

export type TeachQuestion = z.infer<typeof TeachQuestionSchema>
export type TeachAnswer = z.infer<typeof TeachAnswerSchema>
