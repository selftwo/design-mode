import type { AnnotationMark, ReviewAnnotation } from './model/board-document.schema'

function markKindGlyph(mark: AnnotationMark | null): string {
  if (!mark) return 'pin'
  if (mark.kind === 'circle') return '○ circle'
  if (mark.kind === 'element') return '▢ element'
  return 'path'
}

export function buildScopeChipLabel(
  annotation: ReviewAnnotation,
  frameAnnotations: ReviewAnnotation[],
  stale: boolean,
): string {
  const ordinal = frameAnnotations.indexOf(annotation) + 1
  const kind = markKindGlyph(annotation.mark)
  if (stale) return `${kind} · stale`
  return `${kind} · #${ordinal}`
}
