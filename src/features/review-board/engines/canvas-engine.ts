import type { LiveReviewFrameConfig } from '@/features/live-review/LiveReviewFrame'
import type { PlayableInteractionMode } from '@/features/playable-option/PlayableOptionFrame'
import type { AnnotationIntent, BoardDocument, ReviewAnnotation, ScreenFrame, ToolMode } from '../model/board-document.schema'

export interface KillConfirmRequest {
  frameId: string
  unitId: string
  dropPosition: { x: number; y: number }
}

export interface CanvasEngineProps {
  document: BoardDocument
  tool: ToolMode
  focusedFrameId: string | null
  liveFrameConfig: LiveReviewFrameConfig | null
  selectedFrameId: string | null
  selectedAnnotationId: string | null
  // When set, the canvas bloom focuses the instruction editor (creation / jump).
  editorFocusId: string | null
  // Per-frame play/review mode for playable options, in memory only (never
  // saved to the board). A frame with no entry defaults to review.
  playableFrameModes: Readonly<Record<string, PlayableInteractionMode>>
  onDocumentChange: (update: BoardDocument | ((current: BoardDocument) => BoardDocument)) => void
  onFocusFrame: (frameId: string) => void
  onSelectFrame: (frameId: string | null) => void
  onSelectAnnotation: (annotationId: string | null) => void
  onAnnotationCreated: (annotation: ReviewAnnotation) => void
  onSaveAnnotationDraft: (instruction: string) => void
  onSetAnnotationIntent: (intent: AnnotationIntent | undefined) => void
  onDeleteAnnotation: () => void
  // Dragging an active option onto a killed zone opens confirm in App; the
  // board never silently kills (a kill always needs a ledger verdict).
  onRequestKillConfirm?: (request: KillConfirmRequest) => void
  // Review-telemetry viewport report (item 6). The adapter reports the raw
  // viewport and canvas size so the pure accumulator can derive per-frame
  // visibility; optional so engines that do not track it stay valid.
  onViewportSample?: (view: { x: number; y: number; zoom: number }, canvasSize: { width: number; height: number }) => void
  onReady: () => void
}

export function replaceFrame(document: BoardDocument, frame: ScreenFrame): BoardDocument {
  return {
    ...document,
    frames: document.frames.map((item) => item.id === frame.id ? frame : item),
  }
}
