import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnnotationInstructionEditor } from '@/features/review-board/AnnotationInstructionEditor'
import { ReviewToolbar } from '@/features/review-board/ReviewToolbar'
import type { CanvasEngineProps } from '@/features/review-board/engines/canvas-engine'
import { readAllowedBoardHostOrigins } from '@/features/review-board/host/board-host-origin-config'
import { createWindowBoardHost } from '@/features/review-board/host/window-board-host'
import { ReviewBoardResetDialog } from '@/features/review-board/ReviewBoardResetDialog'
import { exportAgentAnnotation } from '@/features/review-board/model/export-agent-annotation'
import type { BoardDocument, EngineName, ReviewAnnotation, ToolMode } from '@/features/review-board/model/board-document.schema'
import { serializeBoardDiagnostics } from '@/features/review-board/serialize-board-diagnostics'
import { useCaptureRefreshOnExit } from '@/features/review-board/use-capture-refresh-on-exit'
import { useLiveFrameSession } from '@/features/review-board/use-live-frame-session'
import { useReviewBoardHostLoad } from '@/features/review-board/use-review-board-host-load'
import { useReviewBoardPersistence } from '@/features/review-board/use-review-board-persistence'

const ReactFlowReviewBoard = lazy(() => import('@/features/review-board/engines/react-flow/ReactFlowReviewBoard'))
const ExcalidrawReviewBoard = lazy(() => import('@/features/review-board/engines/excalidraw/ExcalidrawReviewBoard'))

function selectedEngine(): EngineName {
  return new URLSearchParams(window.location.search).get('engine') === 'excalidraw'
    ? 'excalidraw'
    : 'reactflow'
}

export default function App() {
  const engine = useMemo(selectedEngine, [])
  const host = useMemo(() => createWindowBoardHost(window, {
    allowedLoadOrigins: readAllowedBoardHostOrigins(window.location),
  }), [])
  const [tool, setTool] = useState<ToolMode>('select')
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [exported, setExported] = useState('')
  const [readyMs, setReadyMs] = useState<number | null>(null)
  const {
    saveStatus,
    saveError,
    resetDialogOpen,
    resetError,
    setBaseline,
    save: persistBoard,
    requestReset,
    cancelReset,
    confirmReset,
    applyImmediateReset,
  } = useReviewBoardPersistence()

  const { session, pendingFrameId, sessionError, beginLiveSession, clearLiveSession } = useLiveFrameSession(host)
  const cancelPendingRefreshRef = useRef<() => void>(() => {})

  const {
    document,
    setDocument,
    hostBoard,
    boardLoadError,
    resetLoadedBoard,
  } = useReviewBoardHostLoad(host, setBaseline, () => {
    setSelectedFrameId(null)
    setSelectedAnnotationId(null)
    clearLiveSession()
    cancelPendingRefreshRef.current()
    setExported('')
    setTool('select')
  })

  const updateDocument: CanvasEngineProps['onDocumentChange'] = useCallback((update) => {
    setDocument((current) => {
      if (!current) return current
      return typeof update === 'function' ? update(current) : update
    })
  }, [setDocument])

  const {
    refreshError,
    refreshing,
    refreshingFrameId,
    requestExitRefresh,
    cancelPendingRefresh,
    bindDocument,
  } = useCaptureRefreshOnExit(host, updateDocument)

  useEffect(() => {
    cancelPendingRefreshRef.current = cancelPendingRefresh
  }, [cancelPendingRefresh])

  useEffect(() => {
    bindDocument(document)
  }, [bindDocument, document])

  const handleCanvasReady = useCallback(() => {
    requestAnimationFrame(() => setReadyMs((current) => current ?? Math.round(performance.now())))
  }, [])

  const focusFrame = (frameId: string) => {
    setSelectedFrameId(frameId)
    setSelectedAnnotationId(null)
    setTool('select')
    beginLiveSession(frameId)
  }

  const exitFocus = () => {
    const frameId = session?.frameId ?? pendingFrameId
    if (!frameId) return
    const hadLiveSession = session !== null
    clearLiveSession()
    if (hadLiveSession && document) requestExitRefresh(document, frameId)
  }

  const applyHostBoard = useCallback((board: BoardDocument) => {
    cancelPendingRefresh()
    resetLoadedBoard(board)
    setSelectedFrameId(null)
    setSelectedAnnotationId(null)
    clearLiveSession()
    setExported('')
    setTool('select')
  }, [cancelPendingRefresh, clearLiveSession, resetLoadedBoard])

  const handleSave = () => {
    if (!document) return
    persistBoard(document)
  }

  const handleReset = () => {
    if (!hostBoard || !document) return
    const outcome = requestReset(document)
    if (!outcome?.immediate) return
    const result = applyImmediateReset(hostBoard)
    if (result.ok) applyHostBoard(result.hostBoard)
  }

  const handleConfirmReset = () => {
    if (!hostBoard) return
    const result = confirmReset(hostBoard)
    if (result.ok) applyHostBoard(result.hostBoard)
  }

  const handleExport = () => {
    if (!document) return
    const targetId = selectedAnnotationId ?? document.annotations.at(-1)?.id
    setExported(targetId ? JSON.stringify(exportAgentAnnotation(document, targetId), null, 2) : '')
  }

  const saveInstructionDraft = useCallback((instruction: string) => {
    if (!selectedAnnotationId) return
    updateDocument((current) => ({
      ...current,
      annotations: current.annotations.map((annotation) => annotation.id === selectedAnnotationId
        ? { ...annotation, instruction }
        : annotation),
    }))
  }, [selectedAnnotationId, updateDocument])

  const deleteSelectedAnnotation = useCallback(() => {
    if (!selectedAnnotationId) return
    updateDocument((current) => ({
      ...current,
      annotations: current.annotations.filter((annotation) => annotation.id !== selectedAnnotationId),
    }))
    setSelectedAnnotationId(null)
  }, [selectedAnnotationId, updateDocument])

  const handleSelectAnnotation = useCallback((annotationId: string | null) => {
    setSelectedAnnotationId(annotationId)
    if (!document || !annotationId) return
    const frameId = document.annotations.find((item) => item.id === annotationId)?.frameId
    if (frameId) setSelectedFrameId(frameId)
  }, [document])

  const handleAnnotationCreated = useCallback((annotation: ReviewAnnotation) => {
    updateDocument((current) => ({
      ...current,
      annotations: [...current.annotations, annotation],
    }))
    setSelectedAnnotationId(annotation.id)
    setSelectedFrameId(annotation.frameId)
  }, [updateDocument])

  const selectedAnnotation = document?.annotations.find((item) => item.id === selectedAnnotationId) ?? null
  const selectedFrame = selectedAnnotation
    ? document?.frames.find((frame) => frame.id === selectedAnnotation.frameId) ?? null
    : null

  if (!document) {
    return (
      <main className="board-load-state" data-testid="board-load-state">
        <h1>Waiting for a board</h1>
        <p>The local host must send a supported board document.</p>
        {boardLoadError ? <p role="alert" data-testid="board-load-error">{boardLoadError}</p> : null}
      </main>
    )
  }

  const liveFrameConfig = session
    ? {
        frameId: session.frameId,
        liveUrl: session.liveUrl,
        allowedOrigin: session.allowedOrigin,
        focusToken: session.focusToken,
      }
    : null
  const focusedFrameId = session?.frameId ?? pendingFrameId

  const canvasProps: CanvasEngineProps = {
    document,
    tool,
    focusedFrameId,
    liveFrameConfig,
    selectedFrameId,
    selectedAnnotationId,
    onDocumentChange: updateDocument,
    onFocusFrame: focusFrame,
    onSelectFrame: setSelectedFrameId,
    onSelectAnnotation: handleSelectAnnotation,
    onAnnotationCreated: handleAnnotationCreated,
    onReady: handleCanvasReady,
  }
  const Canvas = engine === 'reactflow' ? ReactFlowReviewBoard : ExcalidrawReviewBoard

  return (
    <div className="app-shell">
      <ReviewToolbar
        engine={engine}
        tool={tool}
        focused={focusedFrameId !== null}
        onTool={setTool}
        onSave={handleSave}
        onReset={handleReset}
        onExport={handleExport}
        onFocusSelected={() => selectedFrameId && focusFrame(selectedFrameId)}
        onExitFocus={exitFocus}
      />
      <aside className="engine-switcher" aria-label="Canvas engine">
        <a href="?engine=reactflow" aria-current={engine === 'reactflow' ? 'page' : undefined}>React Flow</a>
        <a href="?engine=excalidraw" aria-current={engine === 'excalidraw' ? 'page' : undefined}>Excalidraw</a>
      </aside>
      <div className="canvas-region">
        <Suspense fallback={<main className="canvas-loading">Loading {engine}…</main>}>
          <Canvas {...canvasProps} />
        </Suspense>
        {selectedAnnotation && selectedFrame ? (
          <AnnotationInstructionEditor
            annotation={selectedAnnotation}
            frame={selectedFrame}
            onSaveDraft={saveInstructionDraft}
            onDelete={deleteSelectedAnnotation}
          />
        ) : null}
      </div>
      {boardLoadError ? <p className="board-load-error" role="alert" data-testid="board-load-error">{boardLoadError}</p> : null}
      {saveError ? (
        <p className="board-save-error" role="alert" data-testid="board-save-error">{saveError}</p>
      ) : null}
      {resetError ? (
        <p className="board-reset-error" role="alert" data-testid="board-reset-error">{resetError}</p>
      ) : null}
      {sessionError ? (
        <p className="live-session-error" role="alert" data-testid="live-session-error">{sessionError}</p>
      ) : null}
      {refreshError ? (
        <p className="capture-refresh-error" role="alert" data-testid="capture-refresh-error">{refreshError}</p>
      ) : null}
      <ReviewBoardResetDialog
        open={resetDialogOpen}
        onCancel={cancelReset}
        onConfirm={handleConfirmReset}
      />
      <footer className="board-status" data-testid="board-status">
        <span>{document.frames.length} screens</span>
        <span data-testid="annotation-count">{document.annotations.length} annotations</span>
        <span data-testid="selected-frame">{selectedFrameId ?? 'none selected'}</span>
        <span data-testid="selected-annotation">{selectedAnnotationId ?? 'none selected'}</span>
        <span data-testid="focus-state">
          {refreshing && refreshingFrameId
            ? `refreshing ${refreshingFrameId}`
            : session
              ? `live ${session.frameId}`
              : pendingFrameId
                ? `connecting ${pendingFrameId}`
                : 'screenshot mode'}
        </span>
        <span data-testid="ready-ms">{readyMs === null ? 'measuring' : `${readyMs} ms`}</span>
        {saveStatus === 'saved' ? <span role="status" data-testid="board-save-status">Saved</span> : null}
      </footer>
      <output className="export-output" data-testid="export-output">{exported}</output>
      <output className="board-diagnostics" data-testid="board-diagnostics">{serializeBoardDiagnostics(document)}</output>
    </div>
  )
}