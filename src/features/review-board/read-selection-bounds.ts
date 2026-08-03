export function readSelectionBounds(
  selectedFrameId: string | null,
  selectedElementId: string | null,
  selectedAnnotationId: string | null,
): DOMRect | null {
  if (selectedAnnotationId) {
    const mark = document.querySelector(`[data-annotation-id="${selectedAnnotationId}"]`)
    if (mark) return mark.getBoundingClientRect()
  }
  if (selectedElementId && selectedFrameId) {
    const element = document.querySelector(`[data-element-id="${selectedElementId}"][data-frame-id="${selectedFrameId}"]`)
    if (element) return element.getBoundingClientRect()
  }
  if (selectedFrameId) {
    const frame = document.querySelector(`[data-testid="frame-${selectedFrameId}"]`)
    if (frame) return frame.getBoundingClientRect()
  }
  return null
}
