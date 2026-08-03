import type { BoardAnnotation } from './model/board-document.schema'

export function isAnnotationResolved(annotation: BoardAnnotation): boolean {
  return Boolean(annotation.resolvedAt)
}
