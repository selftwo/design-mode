import type { ReviewAnnotation, ScreenFrame } from './board-document.schema'

export function isAnnotationStale(annotation: ReviewAnnotation, frame: ScreenFrame): boolean {
  return annotation.madeAgainstCaptureHash !== frame.captureHash
    || annotation.madeAgainstRevision !== frame.revision
}