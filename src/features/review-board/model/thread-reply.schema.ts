import { z } from 'zod'

export const ThreadReplySchema = z.object({
  id: z.string().min(1),
  body: z.string().min(1),
  author: z.string().min(1),
  createdAt: z.string().datetime(),
})

export type ThreadReply = z.infer<typeof ThreadReplySchema>
