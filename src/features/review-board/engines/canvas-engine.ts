import type { LiveReviewFrameConfig } from '@/features/live-review/LiveReviewFrame'
import type { BoardDocument, FrameElement, ReviewAnnotation, ScreenFrame, ToolMode } from '../model/board-document.schema'
import type { LayersTreeTarget } from '../build-layers-tree'

export interface CanvasEngineProps {
  document: BoardDocument
  tool: ToolMode
  learnLensOpen: boolean
  focusedFrameId: string | null
  liveFrameConfig: LiveReviewFrameConfig | null
  selectedFrameId: string | null
  selectedElementId: string | null
  selectedAnnotationId: string | null
  pendingJumpAnnotationId: string | null
  outlinedTarget: LayersTreeTarget | null
  resolvedAnnotationIds: ReadonlySet<string>
  onDocumentChange: (update: BoardDocument | ((current: BoardDocument) => BoardDocument)) => void
  onFocusFrame: (frameId: string) => void
  onSelectFrame: (frameId: string | null) => void
  onSelectElement: (frameId: string | null, elementId: string | null) => void
  onLearnElementPick: (frameId: string, element: FrameElement) => void
  onSelectAnnotation: (annotationId: string | null) => void
  onAnnotationCreated: (annotation: ReviewAnnotation) => void
  onDeleteTeachAnnotation: (annotationId: string) => void
  onResolveTeachAnnotation: (annotationId: string) => void
  onJumpHandled: () => void
  onReady: () => void
}

export function replaceFrame(document: BoardDocument, frame: ScreenFrame): BoardDocument {
  return {
    ...document,
    frames: document.frames.map((item) => item.id === frame.id ? frame : item),
  }
}