import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { boardsSemanticallyEqual } from '@/features/review-board/model/board-semantic-equality'
import { exportAgentAnnotation } from '@/features/review-board/model/export-agent-annotation'
import { buildReviewBatch, collectReviewBatchBlocks } from '@/features/review-board/model/review-batch'
import { copyReviewText } from '@/features/review-board/copy-review-text'
import { ReviewCommentsPanel, type PoolCopyState } from '@/features/review-board/ReviewCommentsPanel'
import { ReviewToolbar } from '@/features/review-board/ReviewToolbar'
import type { CanvasEngineProps } from '@/features/review-board/engines/canvas-engine'
import { readAllowedBoardHostOrigins } from '@/features/review-board/host/board-host-origin-config'
import { createWindowBoardHost } from '@/features/review-board/host/window-board-host'
import { ReviewBoardResetDialog } from '@/features/review-board/ReviewBoardResetDialog'
import type { AnnotationIntent, BoardDocument, EngineName, ReviewAnnotation, ToolMode } from '@/features/review-board/model/board-document.schema'
import { serializeBoardDiagnostics } from '@/features/review-board/serialize-board-diagnostics'
import { useCaptureRefreshOnExit } from '@/features/review-board/use-capture-refresh-on-exit'
import { useLiveFrameSession } from '@/features/review-board/use-live-frame-session'
import { useReviewBatchExport } from '@/features/review-board/use-review-batch-export'
import { useReviewBoardHostLoad } from '@/features/review-board/use-review-board-host-load'
import { useReviewBoardPersistence } from '@/features/review-board/use-review-board-persistence'
import { buildUploadFrames, listImportableImageFiles, readImageFile } from '@/features/review-board/upload/import-image-frames'
import { AgentActivityRail } from '@/features/local-host/AgentActivityRail'
import { DesignContextPane } from '@/features/local-host/DesignContextPane'
import { HostProjectPicker } from '@/features/local-host/HostProjectPicker'
import { createLocalHostClient } from '@/features/local-host/local-host-client'
import { activeProjectIdFromLocation, isServedByLocalHost } from '@/features/local-host/local-host-detection'
import type { AgentAvailability, AgentId, AgentRun } from '@/features/local-host/host-api.schema'

const ReactFlowReviewBoard = lazy(() => import('@/features/review-board/engines/react-flow/ReactFlowReviewBoard'))
const ExcalidrawReviewBoard = lazy(() => import('@/features/review-board/engines/excalidraw/ExcalidrawReviewBoard'))

const AUTOSAVE_DELAY_MS = 600

function selectedEngine(): EngineName {
  return new URLSearchParams(window.location.search).get('engine') === 'excalidraw'
    ? 'excalidraw'
    : 'reactflow'
}

export default function App() {
  const engine = useMemo(selectedEngine, [])
  const localHost = useMemo(
    () => (isServedByLocalHost() ? createLocalHostClient(activeProjectIdFromLocation()) : null),
    [],
  )
  const host = useMemo(() => localHost ?? createWindowBoardHost(window, {
    allowedLoadOrigins: readAllowedBoardHostOrigins(window.location),
  }), [localHost])
  const [tool, setTool] = useState<ToolMode>('select')
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [editorFocusId, setEditorFocusId] = useState<string | null>(null)
  const [exportEmptyNotice, setExportEmptyNotice] = useState(false)
  const [batchCopyState, setBatchCopyState] = useState<PoolCopyState>('idle')
  const [poolCopyState, setPoolCopyState] = useState<PoolCopyState>('idle')
  const [copiedAnnotationId, setCopiedAnnotationId] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [dispatchAgent, setDispatchAgent] = useState<AgentId>('claude')
  const [dispatchAgents, setDispatchAgents] = useState<AgentAvailability[] | null>(null)
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([])
  const [captureActive, setCaptureActive] = useState(false)
  const [boardUpdateWaiting, setBoardUpdateWaiting] = useState(false)
  const [readyMs, setReadyMs] = useState<number | null>(null)
  const boardStorage = localHost?.boardStorage
  const {
    lastSaved,
    saveStatus,
    saveError,
    resetDialogOpen,
    resetError,
    setBaseline,
    save: persistBoard,
    clearSaveError,
    clearResetError,
    requestReset,
    cancelReset,
    confirmReset,
    applyImmediateReset,
  } = useReviewBoardPersistence(boardStorage)

  const { session, pendingFrameId, sessionError, beginLiveSession, clearLiveSession, clearSessionError } = useLiveFrameSession(host)
  const cancelPendingRefreshRef = useRef<() => void>(() => {})
  const {
    status: exportStatus,
    deliveryError: exportDeliveryError,
    lastBatch: exportedBatch,
    requestExport,
    flagBlocks,
    resetExportState,
    acknowledgeDelivery,
    dismissDeliveryError,
  } = useReviewBatchExport(host)

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
    resetExportState()
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
    clearRefreshError,
    bindDocument,
  } = useCaptureRefreshOnExit(host, updateDocument)

  // A delivered batch describes a moment in time: editing the board afterwards makes it stale.
  useEffect(() => {
    acknowledgeDelivery()
  }, [document, acknowledgeDelivery])

  useEffect(() => {
    setBatchCopyState('idle')
  }, [exportStatus, exportedBatch])

  useEffect(() => {
    setPoolCopyState('idle')
    setCopiedAnnotationId(null)
  }, [document])

  // The board saves itself; a save error pauses retries until it is dismissed or the board changes.
  useEffect(() => {
    if (!document || !lastSaved || saveError) return
    if (boardsSemanticallyEqual(document, lastSaved)) return
    const timer = window.setTimeout(() => persistBoard(document), AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [document, lastSaved, saveError, persistBoard])

  const boardDirty = useMemo(
    () => document !== null && lastSaved !== null && !boardsSemanticallyEqual(document, lastSaved),
    [document, lastSaved],
  )

  const exportBlocks = useMemo(
    () => (exportStatus === 'blocked' && document ? collectReviewBatchBlocks(document) : []),
    [exportStatus, document],
  )

  useEffect(() => {
    if (exportStatus === 'blocked' && exportBlocks.length === 0) resetExportState()
  }, [exportStatus, exportBlocks.length, resetExportState])

  useEffect(() => {
    if (exportEmptyNotice && document && document.annotations.length > 0) setExportEmptyNotice(false)
  }, [exportEmptyNotice, document])

  useEffect(() => {
    cancelPendingRefreshRef.current = cancelPendingRefresh
  }, [cancelPendingRefresh])

  useEffect(() => {
    bindDocument(document)
  }, [bindDocument, document])

  // Local app mode: agents appear as collaborators. The host streams run and
  // capture events; a finished run refreshes captures and reloads the board
  // once local edits are safe.
  useEffect(() => {
    if (!localHost?.activeProjectId) return
    void localHost.listAgents().then(setDispatchAgents).catch(() => setDispatchAgents([]))
    void localHost.listRuns()
      .then((runs) => setAgentRuns(runs.filter((run) => run.projectId === localHost.activeProjectId)))
      .catch(() => {})
    return localHost.subscribeHostEvents((event) => {
      if (event.type === 'run-updated' && event.run.projectId === localHost.activeProjectId) {
        setAgentRuns((current) => [event.run, ...current.filter((run) => run.id !== event.run.id)])
      }
      if (event.type === 'capture-started' && event.projectId === localHost.activeProjectId) {
        setCaptureActive(true)
      }
      if (event.type === 'capture-failed' && event.projectId === localHost.activeProjectId) {
        setCaptureActive(false)
      }
      if (event.type === 'board-updated' && event.projectId === localHost.activeProjectId) {
        setCaptureActive(false)
        setBoardUpdateWaiting(true)
      }
    })
  }, [localHost])

  useEffect(() => {
    localHost?.setDispatchAgent(dispatchAgent)
  }, [localHost, dispatchAgent])

  useEffect(() => {
    if (!boardUpdateWaiting || !localHost || boardDirty) return
    setBoardUpdateWaiting(false)
    host.requestBoard()
  }, [boardUpdateWaiting, localHost, boardDirty, host])

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
    resetExportState()
    setExportEmptyNotice(false)
    setTool('select')
  }, [cancelPendingRefresh, clearLiveSession, resetLoadedBoard, resetExportState])

  const handleReset = () => {
    if (!hostBoard || !document) return
    const outcome = requestReset(document, hostBoard)
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
    if (document.annotations.length === 0) {
      setExportEmptyNotice(true)
      return
    }
    setExportEmptyNotice(false)
    requestExport(document)
  }

  const copyDeliveredBatch = () => {
    if (!exportedBatch) return
    copyReviewText(JSON.stringify(exportedBatch, null, 2))
      .then((copied) => setBatchCopyState(copied ? 'copied' : 'failed'))
  }

  const copyAllComments = () => {
    if (!document) return
    if (document.annotations.length === 0) {
      setExportEmptyNotice(true)
      return
    }
    const result = buildReviewBatch(document)
    if (!result.ok) {
      flagBlocks(result.blocks)
      return
    }
    copyReviewText(JSON.stringify(result.batch, null, 2))
      .then((copied) => setPoolCopyState(copied ? 'copied' : 'failed'))
  }

  const copySingleComment = (annotationId: string) => {
    if (!document) return
    try {
      const record = exportAgentAnnotation(document, annotationId)
      copyReviewText(JSON.stringify(record, null, 2))
        .then((copied) => setCopiedAnnotationId(copied ? annotationId : null))
    } catch {
      setCopiedAnnotationId(null)
    }
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

  const importImages = useCallback(async (files: File[]) => {
    if (!document) return
    const importable = listImportableImageFiles(files)
    if (importable.length === 0) {
      setImportError('Only PNG, JPEG, and WebP images can be imported.')
      return
    }
    try {
      const images = await Promise.all(importable.map(readImageFile))
      const frames = buildUploadFrames(document, images)
      updateDocument((current) => ({ ...current, frames: [...current.frames, ...frames] }))
      setImportError(null)
      const first = frames[0]
      if (first) {
        setSelectedFrameId(first.id)
        setSelectedAnnotationId(null)
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'The dropped images could not be imported.')
    }
  }, [document, updateDocument])

  const setSelectedAnnotationIntent = useCallback((intent: AnnotationIntent | undefined) => {
    if (!selectedAnnotationId) return
    updateDocument((current) => ({
      ...current,
      annotations: current.annotations.map((annotation) => annotation.id === selectedAnnotationId
        ? { ...annotation, intent }
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
    setEditorFocusId(null)
    if (!document || !annotationId) return
    const frameId = document.annotations.find((item) => item.id === annotationId)?.frameId
    if (frameId) setSelectedFrameId(frameId)
  }, [document])

  const jumpToAnnotation = useCallback((annotationId: string) => {
    handleSelectAnnotation(annotationId)
    setEditorFocusId(annotationId)
  }, [handleSelectAnnotation])

  const handleAnnotationCreated = useCallback((annotation: ReviewAnnotation) => {
    updateDocument((current) => ({
      ...current,
      annotations: [...current.annotations, annotation],
    }))
    setSelectedAnnotationId(annotation.id)
    setSelectedFrameId(annotation.frameId)
    setEditorFocusId(annotation.id)
  }, [updateDocument])

  if (localHost && !localHost.activeProjectId) {
    return <HostProjectPicker client={localHost} />
  }

  if (!document) {
    return (
      <main className="board-load-state" data-testid="board-load-state">
        <h1>Waiting for a board</h1>
        <p>{localHost ? 'Loading this project’s board from the local host.' : 'The local host must send a supported board document.'}</p>
        {boardLoadError ? <p role="alert" data-testid="board-load-error">{boardLoadError}</p> : null}
        {localHost ? <p><a href="/">Back to projects</a></p> : null}
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
        canFocus={selectedFrameId !== null}
        onTool={setTool}
        onReset={handleReset}
        onFocusSelected={() => selectedFrameId && focusFrame(selectedFrameId)}
        onExitFocus={exitFocus}
        onImportImages={importImages}
      >
        <aside className="engine-switcher" aria-label="Canvas engine">
          <a href="?engine=reactflow" aria-current={engine === 'reactflow' ? 'page' : undefined}>React Flow</a>
          <a href="?engine=excalidraw" aria-current={engine === 'excalidraw' ? 'page' : undefined}>Excalidraw</a>
        </aside>
        {localHost ? <a className="projects-link" href="/" data-testid="back-to-projects">Projects</a> : null}
      </ReviewToolbar>
      <div
        className={`canvas-region ${localHost ? 'with-context' : ''}`}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault()
        }}
        onDrop={(event) => {
          if (event.dataTransfer.files.length === 0) return
          event.preventDefault()
          void importImages([...event.dataTransfer.files])
        }}
      >
        {localHost ? <DesignContextPane client={localHost} /> : null}
        <Suspense fallback={<main className="canvas-loading">Loading {engine}…</main>}>
          <Canvas {...canvasProps} />
        </Suspense>
        {localHost ? <AgentActivityRail runs={agentRuns} capturing={captureActive} /> : null}
        <ReviewCommentsPanel
          document={document}
          selectedAnnotationId={selectedAnnotationId}
          editorFocusId={editorFocusId}
          copiedAnnotationId={copiedAnnotationId}
          poolCopyState={poolCopyState}
          onJump={jumpToAnnotation}
          onSaveDraft={saveInstructionDraft}
          onSetIntent={setSelectedAnnotationIntent}
          onDelete={deleteSelectedAnnotation}
          onCopyAnnotation={copySingleComment}
          onCopyAll={copyAllComments}
          onExport={handleExport}
          dispatchAgents={localHost ? dispatchAgents ?? [] : null}
          dispatchAgent={dispatchAgent}
          onDispatchAgent={setDispatchAgent}
        />
      </div>
      <div className="status-banners" data-testid="status-banners">
        {boardLoadError ? <p className="board-load-error" role="alert" data-testid="board-load-error">{boardLoadError}</p> : null}
        {saveError ? (
          <p className="board-save-error" role="alert" data-testid="board-save-error">
            {saveError}
            <button type="button" className="banner-dismiss" onClick={clearSaveError} aria-label="Dismiss save error">×</button>
          </p>
        ) : null}
        {resetError ? (
          <p className="board-reset-error" role="alert" data-testid="board-reset-error">
            {resetError}
            <button type="button" className="banner-dismiss" onClick={clearResetError} aria-label="Dismiss reset error">×</button>
          </p>
        ) : null}
        {boardUpdateWaiting && boardDirty ? (
          <p className="board-update-notice export-empty-notice" role="status" data-testid="board-update-notice">
            An agent refreshed this board’s captures.
            <button
              type="button"
              className="banner-action"
              data-testid="reload-updated-board"
              onClick={() => {
                setBoardUpdateWaiting(false)
                host.requestBoard()
              }}
            >
              Reload board
            </button>
          </p>
        ) : null}
        {importError ? (
          <p className="image-import-error" role="alert" data-testid="image-import-error">
            {importError}
            <button type="button" className="banner-dismiss" onClick={() => setImportError(null)} aria-label="Dismiss import error">×</button>
          </p>
        ) : null}
        {sessionError ? (
          <p className="live-session-error" role="alert" data-testid="live-session-error">
            {sessionError}
            <button type="button" className="banner-dismiss" onClick={clearSessionError} aria-label="Dismiss live session error">×</button>
          </p>
        ) : null}
        {refreshError ? (
          <p className="capture-refresh-error" role="alert" data-testid="capture-refresh-error">
            {refreshError}
            <button type="button" className="banner-dismiss" onClick={clearRefreshError} aria-label="Dismiss capture refresh error">×</button>
          </p>
        ) : null}
        {exportStatus === 'blocked' ? (
          <p className="export-validation-error" role="alert" data-testid="export-validation-error">
            {`Fix ${exportBlocks.length} annotation${exportBlocks.length === 1 ? '' : 's'} before export: `}
            {exportBlocks.map((block, index) => {
              const owner = document.annotations.find((item) => item.id === block.annotationId)
              const frame = document.frames.find((item) => item.id === owner?.frameId)
              return (
                <span key={block.annotationId}>
                  {index > 0 ? ', ' : ''}
                  <button type="button" className="banner-action" onClick={() => jumpToAnnotation(block.annotationId)}>
                    {frame ? `${frame.label} (${block.annotationId})` : block.annotationId}
                  </button>
                </span>
              )
            })}
          </p>
        ) : null}
        {exportStatus === 'error' && exportDeliveryError ? (
          <p className="export-delivery-error" role="alert" data-testid="export-delivery-error">
            {exportDeliveryError}
            <button type="button" className="banner-dismiss" onClick={dismissDeliveryError} aria-label="Dismiss export error">×</button>
          </p>
        ) : null}
        {exportStatus === 'delivered' && exportedBatch ? (
          <p className="export-delivered-notice" role="status" data-testid="export-delivered-notice">
            {`Review batch delivered (${exportedBatch.annotations.length} annotation${exportedBatch.annotations.length === 1 ? '' : 's'}).`}
            <button type="button" className="banner-action" data-testid="copy-review-batch" onClick={copyDeliveredBatch}>
              {batchCopyState === 'copied' ? 'Copied' : batchCopyState === 'failed' ? 'Copy failed, retry' : 'Copy JSON'}
            </button>
          </p>
        ) : null}
        {exportEmptyNotice ? (
          <p className="export-empty-notice" role="status" data-testid="export-empty-notice">
            Nothing to export yet. Add an annotation with an instruction first.
            <button type="button" className="banner-dismiss" onClick={() => setExportEmptyNotice(false)} aria-label="Dismiss export notice">×</button>
          </p>
        ) : null}
      </div>
      <ReviewBoardResetDialog
        open={resetDialogOpen}
        onCancel={cancelReset}
        onConfirm={handleConfirmReset}
      />
      <footer className="board-status" data-testid="board-status">
        <span>{document.frames.length} screen{document.frames.length === 1 ? '' : 's'}</span>
        <span data-testid="annotation-count">
          {document.annotations.length} annotation{document.annotations.length === 1 ? '' : 's'}
        </span>
        <span aria-live="polite" data-testid="selected-frame">{selectedFrameId ?? 'none selected'}</span>
        <span aria-live="polite" data-testid="selected-annotation">{selectedAnnotationId ?? 'none selected'}</span>
        <span aria-live="polite" data-testid="focus-state">
          {refreshing && refreshingFrameId
            ? `refreshing ${refreshingFrameId}`
            : session
              ? `live ${session.frameId}`
              : pendingFrameId
                ? `connecting ${pendingFrameId}`
                : 'screenshot mode'}
        </span>
        <span data-testid="ready-ms">{readyMs === null ? 'measuring' : `${readyMs} ms`}</span>
        {boardDirty && !saveError
          ? <span role="status" data-testid="board-save-status">Saving…</span>
          : saveStatus === 'saved'
            ? <span role="status" data-testid="board-save-status">Saved</span>
            : null}
        {exportStatus === 'delivered' ? <span role="status" data-testid="export-status">Delivered</span> : null}
      </footer>
      <output className="export-output" data-testid="export-output">
        {exportedBatch ? JSON.stringify(exportedBatch, null, 2) : ''}
      </output>
      <output className="board-diagnostics" data-testid="board-diagnostics">{serializeBoardDiagnostics(document)}</output>
    </div>
  )
}