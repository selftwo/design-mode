import {
  MIME_TYPES,
  convertToExcalidrawElements,
} from '@excalidraw/excalidraw'
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type { ExcalidrawElement, FileId } from '@excalidraw/excalidraw/element/types'
import type { BinaryFileData, BinaryFiles, DataURL } from '@excalidraw/excalidraw/types'
import type { BoardDocument, ReviewAnnotation, ScreenFrame } from '../../model/board-document.schema'
import { normalizedPathBounds } from '../../model/board-geometry'

const groupId = (frameId: string) => `review-group-${frameId}`
const elementId = (frameId: string) => `review-frame-${frameId}`
const fileId = (frameId: string) => `review-file-${frameId}` as FileId

function annotationSkeleton(annotation: ReviewAnnotation, frame: ScreenFrame): ExcalidrawElementSkeleton {
  const shared = {
    id: `review-annotation-${annotation.id}`,
    groupIds: [groupId(frame.id)],
    strokeColor: annotation.mark ? '#ff3d71' : '#6439ff',
    backgroundColor: annotation.mark ? 'transparent' : '#6439ff',
    fillStyle: 'solid' as const,
    strokeWidth: 3,
    roughness: 0,
    opacity: 100,
    customData: {
      reviewKind: 'annotation',
      annotationId: annotation.id,
      frameId: frame.id,
    },
  }

  if (annotation.mark) {
    // Path and element marks project to their bounding shape in this optional engine.
    const [start, end] = annotation.mark.kind === 'path'
      ? normalizedPathBounds(annotation.mark.points)
      : annotation.mark.points
    return {
      ...shared,
      type: annotation.mark.kind === 'element' ? 'rectangle' : 'ellipse',
      x: frame.x + Math.min(start[0], end[0]) * frame.width,
      y: frame.y + Math.min(start[1], end[1]) * frame.height,
      width: Math.abs(end[0] - start[0]) * frame.width,
      height: Math.abs(end[1] - start[1]) * frame.height,
    }
  }

  const diameter = Math.max(12, Math.min(frame.width, frame.height) * 0.045)
  return {
    ...shared,
    type: 'ellipse',
    x: frame.x + annotation.anchor[0] * frame.width - diameter / 2,
    y: frame.y + annotation.anchor[1] * frame.height - diameter / 2,
    width: diameter,
    height: diameter,
  }
}

function frameSkeleton(frame: ScreenFrame): ExcalidrawElementSkeleton {
  return {
    type: 'image',
    id: elementId(frame.id),
    fileId: fileId(frame.id),
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    status: 'saved',
    scale: [1, 1],
    groupIds: [groupId(frame.id)],
    roughness: 0,
    strokeWidth: 1,
    customData: {
      reviewKind: 'frame',
      frameId: frame.id,
    },
  }
}

export function projectDocument(document: BoardDocument): ExcalidrawElement[] {
  const skeletons: ExcalidrawElementSkeleton[] = []
  for (const frame of document.frames) {
    skeletons.push(frameSkeleton(frame))
    for (const annotation of document.annotations.filter((item) => item.frameId === frame.id)) {
      skeletons.push(annotationSkeleton(annotation, frame))
    }
  }
  return convertToExcalidrawElements(skeletons, { regenerateIds: false })
}

export function projectFiles(document: BoardDocument): BinaryFiles {
  return Object.fromEntries(document.frames.map((frame) => {
    const id = fileId(frame.id)
    const file: BinaryFileData = {
      id,
      mimeType: MIME_TYPES.svg,
      dataURL: (frame.revision > 1 ? frame.refreshedScreenshotDataUrl : frame.screenshotDataUrl) as DataURL,
      created: 1,
      version: frame.revision,
    }
    return [id, file]
  }))
}

export function frameIdFromElement(element: ExcalidrawElement): string | null {
  const data = element.customData as { reviewKind?: string; frameId?: string } | undefined
  return data?.reviewKind === 'frame' && data.frameId ? data.frameId : null
}

export function mergeSceneFrames(document: BoardDocument, elements: readonly ExcalidrawElement[]): BoardDocument {
  let changed = false
  const frames = document.frames.map((frame) => {
    const element = elements.find((candidate) => frameIdFromElement(candidate) === frame.id)
    if (!element || element.type !== 'image') return frame
    const width = Math.max(120, element.width)
    const height = width / frame.aspectRatio
    if (
      Math.abs(element.x - frame.x) < 0.1
      && Math.abs(element.y - frame.y) < 0.1
      && Math.abs(width - frame.width) < 0.1
      && Math.abs(height - frame.height) < 0.1
    ) return frame
    changed = true
    return { ...frame, x: element.x, y: element.y, width, height }
  })
  return changed ? { ...document, frames } : document
}

export function sceneDiagnostics(elements: readonly ExcalidrawElement[]) {
  return elements
    .filter((element) => {
      const data = element.customData as { reviewKind?: string } | undefined
      return data?.reviewKind === 'frame' || data?.reviewKind === 'annotation'
    })
    .map((element) => ({
      id: element.id,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      customData: element.customData,
    }))
}
