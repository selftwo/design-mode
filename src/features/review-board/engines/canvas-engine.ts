import type { LiveReviewFrameConfig } from '@/features/live-review/LiveReviewFrame'
import type { BoardDocument, ReviewAnnotation, ScreenFrame, ToolMode } from '../model/board-document.schema'

export interface CanvasEngineProps {
  document: BoardDocument
  tool: ToolMode
  focusedFrameId: string | null
  liveFrameConfig: LiveReviewFrameConfig | null
  selectedFrameId: string | null
  selectedAnnotationId: string | null
  onDocumentChange: (update: BoardDocument | ((current: BoardDocument) => BoardDocument)) => void
  onFocusFrame: (frameId: string) => void
  onSelectFrame: (frameId: string | null) => void
  onSelectAnnotation: (annotationId: string | null) => void
  onAnnotationCreated: (annotation: ReviewAnnotation) => void
  onReady: () => void
}

export function replaceFrame(document: BoardDocument, frame: ScreenFrame): BoardDocument {
  return {
    ...document,
    frames: document.frames.map((item) => item.id === frame.id ? frame : item),
  }
}