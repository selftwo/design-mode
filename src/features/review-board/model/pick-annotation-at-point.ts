import type { NormalizedPoint, ReviewAnnotation } from './board-document.schema'
import { clampUnit } from './board-geometry'

const COMMENT_HIT_RADIUS = 0.04

function annotationPaintOrder(
  annotations: ReviewAnnotation[],
  selectedAnnotationId: string | null,
): ReviewAnnotation[] {
  return [...annotations].sort((left, right) => {
    if (left.id === selectedAnnotationId) return 1
    if (right.id === selectedAnnotationId) return -1
    return 0
  })
}

function hitsComment(anchor: NormalizedPoint, point: NormalizedPoint): boolean {
  const dx = point[0] - anchor[0]
  const dy = point[1] - anchor[1]
  return dx * dx + dy * dy <= COMMENT_HIT_RADIUS * COMMENT_HIT_RADIUS
}

function hitsCircle(
  points: readonly [NormalizedPoint, NormalizedPoint],
  point: NormalizedPoint,
): boolean {
  const [start, end] = points
  const cx = (start[0] + end[0]) / 2
  const cy = (start[1] + end[1]) / 2
  const rx = Math.max(Math.abs(end[0] - start[0]) / 2, 0.008)
  const ry = Math.max(Math.abs(end[1] - start[1]) / 2, 0.008)
  const nx = (point[0] - cx) / rx
  const ny = (point[1] - cy) / ry
  return nx * nx + ny * ny <= 1
}

function hitsAnnotation(annotation: ReviewAnnotation, point: NormalizedPoint): boolean {
  if (annotation.mark) {
    return hitsCircle(annotation.mark.points, point)
  }
  return hitsComment(annotation.anchor, point)
}

export function pickAnnotationAtNormalizedPoint(
  annotations: ReviewAnnotation[],
  point: NormalizedPoint,
  selectedAnnotationId: string | null = null,
): string | null {
  const ordered = annotationPaintOrder(annotations, selectedAnnotationId)
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const annotation = ordered[index]!
    if (hitsAnnotation(annotation, point)) return annotation.id
  }
  return null
}

export function normalizedPointFromClientRect(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): NormalizedPoint {
  return [
    clampUnit((clientX - rect.left) / rect.width),
    clampUnit((clientY - rect.top) / rect.height),
  ]
}

export function pickAnnotationAtClientPoint(
  annotations: ReviewAnnotation[],
  clientX: number,
  clientY: number,
  surfaceRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  selectedAnnotationId: string | null = null,
): string | null {
  if (surfaceRect.width <= 0 || surfaceRect.height <= 0) return null
  const point = normalizedPointFromClientRect(clientX, clientY, surfaceRect)
  return pickAnnotationAtNormalizedPoint(annotations, point, selectedAnnotationId)
}