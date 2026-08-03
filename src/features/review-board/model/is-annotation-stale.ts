import type { BoardAnnotation, ScreenFrame } from './board-document.schema'

export function isAnnotationStale(annotation: BoardAnnotation, frame: ScreenFrame): boolean {
  return annotation.madeAgainstCaptureHash !== frame.captureHash
    || annotation.madeAgainstRevision !== frame.revision
}