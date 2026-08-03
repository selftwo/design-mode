import type { BoardDocument } from './model/board-document.schema'

export function resolveBoardAnnotation(document: BoardDocument, annotationId: string): BoardDocument {
  const resolvedAt = new Date().toISOString()
  return {
    ...document,
    annotations: document.annotations.map((annotation) => (
      annotation.id === annotationId ? { ...annotation, resolvedAt } : annotation
    )),
  }
}
