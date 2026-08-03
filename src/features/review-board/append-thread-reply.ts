import type { BoardDocument } from './model/board-document.schema'
import { isReviewAnnotation } from './is-board-annotation'

export function appendThreadReply(
  document: BoardDocument,
  annotationId: string,
  body: string,
  author = 'Reviewer',
): BoardDocument {
  const trimmed = body.trim()
  if (!trimmed) return document
  return {
    ...document,
    annotations: document.annotations.map((annotation) => {
      if (annotation.id !== annotationId || !isReviewAnnotation(annotation)) return annotation
      const replies = annotation.replies ?? []
      return {
        ...annotation,
        replies: [
          ...replies,
          {
            id: crypto.randomUUID(),
            body: trimmed,
            author,
            createdAt: new Date().toISOString(),
          },
        ],
      }
    }),
  }
}
