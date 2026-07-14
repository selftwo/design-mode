import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { AnnotationInstructionEditor } from '@/features/review-board/AnnotationInstructionEditor'
import { ReviewToolbar } from '@/features/review-board/ReviewToolbar'
import type { CanvasEngineProps } from '@/features/review-board/engines/canvas-engine'
import { readAllowedBoardHostOrigins } from '@/features/review-board/host/board-host-origin-config'
import { createWindowBoardHost } from '@/features/review-board/host/window-board-host'
import { ReviewBoardResetDialog } from '@/features/review-board/ReviewBoardResetDialog'
import { exportAgentAnnotation } from '@/features/review-board/model/export-agent-annotation'
import { loadBoardFromHostStorage } from '@/features/review-board/model/load-board-from-host-storage'
import type { BoardDocument, EngineName, ReviewAnnotation, ToolMode } from '@/features/review-board/model/board-document.schema'
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
  const [document, setDocument] = useState<BoardDocument | null>(null)
  const [hostBoard, setHostBoard] = useState<BoardDocument | null>(null)
  const [boardLoadError, setBoardLoadError] = useState<string | null>(null)
  const [tool, setTool] = useState<ToolMode>('select')
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ frameId: string; token: string } | null>(null)
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

  useEffect(() => {
    const unsubscribe = host.subscribe((result) => {
      if (result.status === 'rejected') {
        setBoardLoadError(result.error)
        return
      }
      if (result.status !== 'loaded') return
      const loaded = loadBoardFromHostStorage(result.board)
      setHostBoard(result.board)
      setDocument(loaded.document)
      setBaseline(loaded.lastSaved)
      setBoardLoadError(null)
      setSelectedFrameId(null)
      setSelectedAnnotationId(null)
      setFocus(null)
      setExported('')
      setTool('select')
    })
    host.requestBoard()
    return unsubscribe
  }, [host, setBaseline])

  const handleCanvasReady = useCallback(() => {
    requestAnimationFrame(() => setReadyMs((current) => current ?? Math.round(performance.now())))
  }, [])

  const updateDocument: CanvasEngineProps['onDocumentChange'] = useCallback((update) => {
    setDocument((current) => {
      if (!current) return current
      return typeof update === 'function' ? update(current) : update
    })
  }, [])

  const focusFrame = (frameId: string) => {
    setSelectedFrameId(frameId)
    setSelectedAnnotationId(null)
    setFocus({ frameId, token: crypto.randomUUID() })
    setTool('select')
  }

  const exitFocus = () => {
    if (!focus) return
    updateDocument((current) => ({
      ...current,
      frames: current.frames.map((frame) => frame.id === focus.frameId
        ? {
            ...frame,
            revision: frame.revision + 1,
            captureHash: `fixture-${frame.id}-revision-${frame.revision + 1}`,
          }
        : frame),
    }))
    setFocus(null)
  }

  const applyHostBoard = useCallback((board: BoardDocument) => {
    setDocument(board)
    setSelectedFrameId(null)
    setSelectedAnnotationId(null)
    setFocus(null)
    setExported('')
    setTool('select')
  }, [])

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

  if (!document) {
    return (
      <main className="board-load-state" data-testid="board-load-state">
        <h1>Waiting for a board</h1>
        <p>The local host must send a supported board document.</p>
        {boardLoadError ? <p role="alert" data-testid="board-load-error">{boardLoadError}</p> : null}
      </main>
    )
  }

  const canvasProps: CanvasEngineProps = {
    document,
    tool,
    focusedFrameId: focus?.frameId ?? null,
    focusToken: focus?.token ?? null,
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
  const boardDiagnostics = JSON.stringify({
    camera: document.camera,
    frames: document.frames.map(({ id, x, y, width, height, aspectRatio, revision, captureHash }) => ({
      id,
      x,
      y,
      width,
      height,
      aspectRatio,
      revision,
      captureHash,
    })),
    annotations: document.annotations.map(({
      id,
      frameId,
      instruction,
      anchor,
      mark,
      madeAgainstCaptureHash,
      madeAgainstRevision,
    }) => ({
      id,
      frameId,
      instruction,
      anchor,
      mark,
      madeAgainstCaptureHash,
      madeAgainstRevision,
    })),
  })

  return (
    <div className="app-shell">
      <ReviewToolbar
        engine={engine}
        tool={tool}
        focused={focus !== null}
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
        {selectedAnnotation ? (
          <AnnotationInstructionEditor
            annotation={selectedAnnotation}
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
        <span data-testid="focus-state">{focus ? `live ${focus.frameId}` : 'screenshot mode'}</span>
        <span data-testid="ready-ms">{readyMs === null ? 'measuring' : `${readyMs} ms`}</span>
        {saveStatus === 'saved' ? <span role="status" data-testid="board-save-status">Saved</span> : null}
      </footer>
      <output className="export-output" data-testid="export-output">{exported}</output>
      <output className="board-diagnostics" data-testid="board-diagnostics">{boardDiagnostics}</output>
    </div>
  )
}
