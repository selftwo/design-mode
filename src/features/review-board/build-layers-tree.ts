import type { BoardDocument, ReviewAnnotation, ScreenFrame, TeachAnnotation } from './model/board-document.schema'
import { isAnnotationStale } from './model/is-annotation-stale'
import { isTeachAnnotation } from './is-board-annotation'

export type LayersTreeTarget =
  | { kind: 'board' }
  | { kind: 'frame'; frameId: string }
  | { kind: 'element'; frameId: string; elementId: string }
  | { kind: 'annotation'; annotationId: string }

export interface LayersTreeRow {
  id: string
  target: LayersTreeTarget
  label: string
  level: number
  glyph: string
  meta?: string
  frameRow?: boolean
  markRow?: boolean
  stale?: boolean
}

function markGlyph(annotation: ReviewAnnotation | TeachAnnotation): string {
  if (isTeachAnnotation(annotation)) return '⌁'
  if (!annotation.mark) return '●'
  if (annotation.mark.kind === 'circle') return '○'
  if (annotation.mark.kind === 'path') return '✎'
  return '▢'
}

function markLabel(annotation: ReviewAnnotation | TeachAnnotation, index: number): string {
  if (isTeachAnnotation(annotation)) return `#${index} teach`
  if (!annotation.mark) return `#${index} comment`
  if (annotation.mark.kind === 'element') return `#${index} element`
  if (annotation.mark.kind === 'path') return `#${index} ink`
  return `#${index} circle`
}

function markMeta(annotation: ReviewAnnotation | TeachAnnotation, frame: ScreenFrame): string {
  if (isTeachAnnotation(annotation)) {
    if (isAnnotationStale(annotation, frame)) return 'stale'
    return 'teach'
  }
  if (isAnnotationStale(annotation, frame)) return 'stale'
  if (annotation.instruction.trim().length > 0) return 'open'
  return 'draft'
}

function frameMeta(frame: ScreenFrame): string {
  const revision = frame.revision > 1 ? ` · rev ${frame.revision}` : ''
  return `${frame.viewport.width}${revision}`
}

function annotationsForFrame(
  document: BoardDocument,
  frameId: string,
  elementId?: string,
) {
  return document.annotations.filter((annotation) => {
    if (annotation.frameId !== frameId) return false
    if (!elementId) return true
    return annotation.mark?.kind === 'element' && annotation.mark.elementId === elementId
  })
}

export function buildLayersTreeRows(document: BoardDocument, boardLabel: string): LayersTreeRow[] {
  const rows: LayersTreeRow[] = [{
    id: 'board',
    target: { kind: 'board' },
    label: boardLabel,
    level: 0,
    glyph: '▦',
  }]

  for (const frame of document.frames) {
    rows.push({
      id: `frame:${frame.id}`,
      target: { kind: 'frame', frameId: frame.id },
      label: frame.label,
      level: 1,
      glyph: '▣',
      meta: frameMeta(frame),
      frameRow: true,
    })

    for (const element of frame.elements) {
      const glyph = /^h[1-6]$/.test(element.role) ? '¶' : '▢'
      rows.push({
        id: `element:${frame.id}:${element.id}`,
        target: { kind: 'element', frameId: frame.id, elementId: element.id },
        label: element.label,
        level: 2,
        glyph,
      })

      const childMarks = annotationsForFrame(document, frame.id, element.id)
      childMarks.forEach((annotation, index) => {
        const stale = isAnnotationStale(annotation, frame)
        rows.push({
          id: `annotation:${annotation.id}`,
          target: { kind: 'annotation', annotationId: annotation.id },
          label: markLabel(annotation, document.annotations.indexOf(annotation) + 1),
          level: 3,
          glyph: markGlyph(annotation),
          meta: markMeta(annotation, frame),
          markRow: true,
          stale,
        })
      })
    }

    const frameMarks = annotationsForFrame(document, frame.id).filter((annotation) => {
      if (!annotation.mark || annotation.mark.kind !== 'element') return true
      return false
    })
    frameMarks.forEach((annotation) => {
      const stale = isAnnotationStale(annotation, frame)
      rows.push({
        id: `annotation:${annotation.id}`,
        target: { kind: 'annotation', annotationId: annotation.id },
        label: markLabel(annotation, document.annotations.indexOf(annotation) + 1),
        level: annotation.mark?.kind === 'element' ? 3 : 2,
        glyph: markGlyph(annotation),
        meta: markMeta(annotation, frame),
        markRow: true,
        stale,
      })
    })
  }

  return rows
}

export function layersTargetKey(target: LayersTreeTarget): string {
  if (target.kind === 'board') return 'board'
  if (target.kind === 'frame') return `frame:${target.frameId}`
  if (target.kind === 'element') return `element:${target.frameId}:${target.elementId}`
  return `annotation:${target.annotationId}`
}

export function resolveLayersSelection(
  document: BoardDocument,
  selectedFrameId: string | null,
  selectedElementId: string | null,
  selectedAnnotationId: string | null,
  boardSelected: boolean,
): LayersTreeTarget | null {
  if (selectedAnnotationId) return { kind: 'annotation', annotationId: selectedAnnotationId }
  if (selectedElementId && selectedFrameId) {
    const frame = document.frames.find((item) => item.id === selectedFrameId)
    if (frame?.elements.some((element) => element.id === selectedElementId)) {
      return { kind: 'element', frameId: selectedFrameId, elementId: selectedElementId }
    }
  }
  if (selectedFrameId) return { kind: 'frame', frameId: selectedFrameId }
  if (boardSelected) return { kind: 'board' }
  return null
}
