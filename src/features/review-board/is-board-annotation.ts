import type { BoardAnnotation, ReviewAnnotation, TeachAnnotation } from './model/board-document.schema'

export function isReviewAnnotation(annotation: BoardAnnotation): annotation is ReviewAnnotation {
  return annotation.kind === 'review'
}

export function isTeachAnnotation(annotation: BoardAnnotation): annotation is TeachAnnotation {
  return annotation.kind === 'teach'
}
