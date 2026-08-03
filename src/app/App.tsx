import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { boardsSemanticallyEqual } from '@/features/review-board/model/board-semantic-equality'
import { exportAgentAnnotation } from '@/features/review-board/model/export-agent-annotation'
import { buildReviewBatch, collectReviewBatchBlocks } from '@/features/review-board/model/review-batch'
import { copyReviewText } from '@/features/review-board/copy-review-text'
import { LearnLensIsland } from '@/features/review-board/LearnLensIsland'
import { deriveLearnContent } from '@/features/review-board/derive-learn-content'
import { buildTeachAnnotation } from '@/features/review-board/build-teach-annotation'
import { isReviewAnnotation } from '@/features/review-board/is-board-annotation'
import { isAnnotationResolved } from '@/features/review-board/is-annotation-resolved'
import { resolveBoardAnnotation } from '@/features/review-board/resolve-board-annotation'
import { askTeachQuestionViaWindowHost } from '@/features/review-board/host/ask-teach-question-via-window-host'
import type { LayersTreeTarget } from '@/features/review-board/build-layers-tree'
import { AnnotationBloom } from '@/features/review-board/AnnotationBloom'
import { ReviewCommentsPanel, type PoolCopyState } from '@/features/review-board/ReviewCommentsPanel'
import { ReviewToolbar } from '@/features/review-board/ReviewToolbar'
import type { CanvasEngineProps } from '@/features/review-board/engines/canvas-engine'
import { readAllowedBoardHostOrigins } from '@/features/review-board/host/board-host-origin-config'
import { createWindowBoardHost } from '@/features/review-board/host/window-board-host'
import { ReviewBoardResetDialog } from '@/features/review-board/ReviewBoardResetDialog'
import type { TeachQuestion } from '@/features/review-board/model/teach-question.schema'
import type { AnnotationIntent, BoardDocument, EngineName, FrameElement, ReviewAnnotation, ToolMode } from '@/features/review-board/model/board-document.schema'
import { LayersAndAspectsIsland } from '@/features/review-board/LayersAndAspectsIsland'
import { serializeBoardDiagnostics } from '@/features/review-board/serialize-board-diagnostics'
import { useCaptureRefreshOnExit } from '@/features/review-board/use-capture-refresh-on-exit'
import { useLiveFrameSession } from '@/features/review-board/use-live-frame-session'
import { useReviewBatchExport } from '@/features/review-board/use-review-batch-export'
import { useReviewBoardHostLoad } from '@/features/review-board/use-review-board-host-load'
import { useReviewBoardPersistence } from '@/features/review-board/use-review-board-persistence'
import { buildUploadFrames, listImportableImageFiles, readImageFile } from '@/features/review-board/upload/import-image-frames'
import { RunsIsland } from '@/features/local-host/RunsIsland'
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
  const [learnLensOpen, setLearnLensOpen] = useState(false)
  const [learnFrameId, setLearnFrameId] = useState<string | null>(null)
  const [learnElementId, setLearnElementId] = useState<string | null>(null)
  const [learnQuestionDraft, setLearnQuestionDraft] = useState('')
  const [learnAskedQuestion, setLearnAskedQuestion] = useState<string | null>(null)
  const [learnAnswer, setLearnAnswer] = useState<string | null>(null)
  const [learnAnswerRunId, setLearnAnswerRunId] = useState<string | null>(null)
  const [learnPinnedElementId, setLearnPinnedElementId] = useState<string | null>(null)
  const [learnAsking, setLearnAsking] = useState(false)
  const [learnAskError, setLearnAskError] = useState<string | null>(null)
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [boardSelected, setBoardSelected] = useState(false)
  const [hoveredLayersTarget, setHoveredLayersTarget] = useState<LayersTreeTarget | null>(null)
  const [editorFocusId, setEditorFocusId] = useState<string | null>(null)
  const [pendingJumpAnnotationId, setPendingJumpAnnotationId] = useState<string | null>(null)
  const [exportEmptyNotice, setExportEmptyNotice] = useState(false)
  const [batchCopyState, setBatchCopyState] = useState<PoolCopyState>('idle')
  const [poolCopyState, setPoolCopyState] = useState<PoolCopyState>('idle')
  const [copiedAnnotationId, setCopiedAnnotationId] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [dispatchAgent, setDispatchAgent] = useState<AgentId>('claude')
  const [dispatchAgents, setDispatchAgents] = useState<AgentAvailability[] | null>(null)
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([])
  const [resolvedAnnotationIds, setResolvedAnnotationIds] = useState<ReadonlySet<string>>(() => new Set())
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
    setSelectedElementId(null)
    setSelectedAnnotationId(null)
    setBoardSelected(false)
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
    setSelectedElementId(null)
    setSelectedAnnotationId(null)
    setBoardSelected(false)
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

  const dispatchSingleAnnotation = (annotationId: string, agent: AgentId) => {
    if (!document) return
    setDispatchAgent(agent)
    const annotation = document.annotations.find((item) => item.id === annotationId)
    if (!annotation) return
    requestExport({ ...document, annotations: [annotation] })
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
        setSelectedElementId(null)
        setSelectedAnnotationId(null)
        setBoardSelected(false)
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'The dropped images could not be imported.')
    }
  }, [document, updateDocument])

  const setSelectedAnnotationIntent = useCallback((intent: AnnotationIntent | undefined) => {
    if (!selectedAnnotationId) return
    updateDocument((current) => ({
      ...current,
      annotations: current.annotations.map((annotation) => annotation.id === selectedAnnotationId && isReviewAnnotation(annotation)
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

  const deleteTeachAnnotation = useCallback((annotationId: string) => {
    updateDocument((current) => ({
      ...current,
      annotations: current.annotations.filter((annotation) => annotation.id !== annotationId),
    }))
    if (selectedAnnotationId === annotationId) setSelectedAnnotationId(null)
  }, [selectedAnnotationId, updateDocument])

  const resolveTeachAnnotation = useCallback((annotationId: string) => {
    setResolvedAnnotationIds((current) => new Set([...current, annotationId]))
    updateDocument((current) => resolveBoardAnnotation(current, annotationId))
  }, [updateDocument])

  const handleSelectFrame = useCallback((frameId: string | null) => {
    setSelectedFrameId(frameId)
    setSelectedElementId(null)
    setSelectedAnnotationId(null)
    setBoardSelected(false)
  }, [])

  const handleSelectElement = useCallback((frameId: string | null, elementId: string | null) => {
    setSelectedFrameId(frameId)
    setSelectedElementId(elementId)
    if (elementId) setSelectedAnnotationId(null)
    setBoardSelected(false)
  }, [])

  const handleSelectAnnotation = useCallback((annotationId: string | null) => {
    setSelectedAnnotationId(annotationId)
    setEditorFocusId(null)
    setBoardSelected(false)
    if (!document || !annotationId) {
      setSelectedElementId(null)
      return
    }
    const annotation = document.annotations.find((item) => item.id === annotationId)
    if (!annotation) return
    setSelectedFrameId(annotation.frameId)
    if (annotation.mark?.kind === 'element') {
      setSelectedElementId(annotation.mark.elementId)
      return
    }
    setSelectedElementId(null)
  }, [document])

  const handleLayersTarget = useCallback((target: LayersTreeTarget) => {
    if (target.kind === 'board') {
      setSelectedFrameId(null)
      setSelectedElementId(null)
      setSelectedAnnotationId(null)
      setBoardSelected(true)
      return
    }
    if (target.kind === 'frame') {
      setSelectedFrameId(target.frameId)
      setSelectedElementId(null)
      setSelectedAnnotationId(null)
      setBoardSelected(false)
      return
    }
    if (target.kind === 'element') {
      setSelectedFrameId(target.frameId)
      setSelectedElementId(target.elementId)
      setSelectedAnnotationId(null)
      setBoardSelected(false)
      return
    }
    handleSelectAnnotation(target.annotationId)
  }, [handleSelectAnnotation])

  const dismissLayersIsland = useCallback(() => {
    setSelectedFrameId(null)
    setSelectedElementId(null)
    setSelectedAnnotationId(null)
    setBoardSelected(false)
    setHoveredLayersTarget(null)
  }, [])

  const jumpToAnnotation = useCallback((annotationId: string) => {
    handleSelectAnnotation(annotationId)
    setEditorFocusId(annotationId)
    setPendingJumpAnnotationId(annotationId)
  }, [handleSelectAnnotation])

  const handleJumpHandled = useCallback(() => {
    setPendingJumpAnnotationId(null)
  }, [])

  const handleAnnotationCreated = useCallback((annotation: ReviewAnnotation) => {
    updateDocument((current) => ({
      ...current,
      annotations: [...current.annotations, annotation],
    }))
    setSelectedAnnotationId(annotation.id)
    setSelectedFrameId(annotation.frameId)
    if (annotation.mark?.kind === 'element') setSelectedElementId(annotation.mark.elementId)
    else setSelectedElementId(null)
    setBoardSelected(false)
    setEditorFocusId(annotation.id)
  }, [updateDocument])

  const handleLearnElementPick = useCallback((frameId: string, element: FrameElement) => {
    setLearnFrameId(frameId)
    setLearnElementId(element.id)
    setLearnQuestionDraft('')
    setLearnAskedQuestion(null)
    setLearnAnswer(null)
    setLearnAnswerRunId(null)
    setLearnPinnedElementId(null)
    setLearnAskError(null)
    setSelectedFrameId(frameId)
    setSelectedElementId(element.id)
    setSelectedAnnotationId(null)
    setBoardSelected(false)
  }, [])

  const toggleLearnLens = useCallback(() => {
    setLearnLensOpen((current) => {
      if (current) {
        setLearnFrameId(null)
        setLearnElementId(null)
        setLearnQuestionDraft('')
        setLearnAskedQuestion(null)
        setLearnAnswer(null)
    setLearnAnswerRunId(null)
    setLearnPinnedElementId(null)
        setLearnAskError(null)
      }
      return !current
    })
  }, [])

  const closeLearnLens = useCallback(() => {
    setLearnLensOpen(false)
    setLearnFrameId(null)
    setLearnElementId(null)
    setLearnQuestionDraft('')
    setLearnAskedQuestion(null)
    setLearnAnswer(null)
    setLearnAnswerRunId(null)
    setLearnPinnedElementId(null)
    setLearnAskError(null)
  }, [])

  const askLearnQuestion = useCallback(async () => {
    if (!document || !learnFrameId || !learnElementId || !learnQuestionDraft.trim()) return
    const frame = document.frames.find((item) => item.id === learnFrameId)
    const element = frame?.elements.find((item) => item.id === learnElementId)
    if (!frame || !element) return
    const content = deriveLearnContent(element, frame)
    const question: TeachQuestion = {
      schemaVersion: 1,
      frameId: frame.id,
      route: frame.route,
      viewport: frame.viewport,
      element: {
        id: element.id,
        label: element.label,
        role: element.role,
        bounds: element.bounds,
      },
      anatomy: content.anatomy,
      vocabularyTerm: content.vocabularyTerm,
      whyLine: content.whyLine,
      question: learnQuestionDraft.trim(),
    }
    setLearnAsking(true)
    setLearnAskError(null)
    setLearnPinnedElementId(null)
    try {
      const answer = localHost
        ? await localHost.askTeachQuestion(question)
        : await askTeachQuestionViaWindowHost(window, question, {
          allowedLoadOrigins: readAllowedBoardHostOrigins(window.location),
        })
      setLearnAskedQuestion(question.question)
      setLearnAnswer(answer.answer)
      setLearnAnswerRunId(answer.runId)
    } catch (error) {
      setLearnAskError(error instanceof Error ? error.message : 'The teach question failed.')
      setLearnAnswer(null)
      setLearnAnswerRunId(null)
      setLearnPinnedElementId(null)
    } finally {
      setLearnAsking(false)
    }
  }, [document, learnElementId, learnFrameId, learnQuestionDraft, localHost])

  const pinLearnAnswer = useCallback(() => {
    if (!document || !learnFrameId || !learnElementId || !learnAnswer || !learnAskedQuestion || !learnAnswerRunId) return
    const frame = document.frames.find((item) => item.id === learnFrameId)
    const element = frame?.elements.find((item) => item.id === learnElementId)
    if (!frame || !element) return
    const annotation = buildTeachAnnotation({
      frame,
      element,
      question: learnAskedQuestion,
      answer: learnAnswer,
      provenanceRunId: learnAnswerRunId,
    })
    updateDocument((current) => ({
      ...current,
      annotations: [...current.annotations, annotation],
    }))
    setSelectedAnnotationId(annotation.id)
    setSelectedFrameId(frame.id)
    setSelectedElementId(element.id)
    setBoardSelected(false)
    setLearnPinnedElementId(element.id)
  }, [document, learnAnswer, learnAnswerRunId, learnAskedQuestion, learnElementId, learnFrameId, updateDocument])

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

  const boardLabel = document.boardId
  const captureSource = localHost ? `localhost:${window.location.port || '5173'}` : null

  const canvasProps: CanvasEngineProps = {
    document,
    tool,
    learnLensOpen,
    focusedFrameId,
    liveFrameConfig,
    selectedFrameId,
    selectedElementId,
    selectedAnnotationId,
    pendingJumpAnnotationId,
    outlinedTarget: hoveredLayersTarget,
    resolvedAnnotationIds,
    onDocumentChange: updateDocument,
    onFocusFrame: focusFrame,
    onSelectFrame: handleSelectFrame,
    onSelectElement: handleSelectElement,
    onLearnElementPick: handleLearnElementPick,
    onSelectAnnotation: handleSelectAnnotation,
    onAnnotationCreated: handleAnnotationCreated,
    onDeleteTeachAnnotation: deleteTeachAnnotation,
    onResolveTeachAnnotation: resolveTeachAnnotation,
    onJumpHandled: handleJumpHandled,
    onReady: handleCanvasReady,
  }
  const Canvas = engine === 'reactflow' ? ReactFlowReviewBoard : ExcalidrawReviewBoard

  const zoomPercent = `${Math.round(document.camera.zoom * 100)}%`
  const saveStateWord = boardDirty && !saveError
    ? 'saving'
    : saveStatus === 'saved'
      ? 'saved'
      : null
  const focusStateLabel = refreshing && refreshingFrameId
    ? `refreshing ${refreshingFrameId}`
    : session
      ? `live ${session.frameId}`
      : pendingFrameId
        ? `connecting ${pendingFrameId}`
        : 'screenshot mode'

  const selectedAnnotation = selectedAnnotationId
    ? document.annotations.find((item) => item.id === selectedAnnotationId) ?? null
    : null
  const selectedAnnotationOrdinal = selectedAnnotation
    ? document.annotations.filter(isReviewAnnotation).findIndex((item) => item.id === selectedAnnotation.id) + 1
    : null
  const selectedAnnotationFrame = selectedAnnotation
    ? document.frames.find((item) => item.id === selectedAnnotation.frameId) ?? null
    : null
  const selectedAnnotationAgentRun = selectedAnnotation
    ? agentRuns.find((run) => run.status === 'done' && run.annotationIds.includes(selectedAnnotation.id)) ?? null
    : null
  const learnFrame = learnFrameId ? document.frames.find((item) => item.id === learnFrameId) ?? null : null
  const learnElement = learnFrame && learnElementId
    ? learnFrame.elements.find((item) => item.id === learnElementId) ?? null
    : null
  const learnContent = learnFrame && learnElement ? deriveLearnContent(learnElement, learnFrame) : null

  return (
    <div className="app-shell dm">
      <div
        className="canvas-region"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault()
        }}
        onDrop={(event) => {
          if (event.dataTransfer.files.length === 0) return
          event.preventDefault()
          void importImages([...event.dataTransfer.files])
        }}
      >
        <Suspense fallback={<main className="canvas-loading">Loading {engine}…</main>}>
          <Canvas {...canvasProps} />
        </Suspense>
        <LayersAndAspectsIsland
          document={document}
          boardLabel={boardLabel}
          captureSource={captureSource}
          boardSelected={boardSelected}
          selectedFrameId={selectedFrameId}
          selectedElementId={selectedElementId}
          selectedAnnotationId={selectedAnnotationId}
          hoveredTarget={hoveredLayersTarget}
          contextClient={localHost}
          onSelectTarget={handleLayersTarget}
          onHoverTarget={setHoveredLayersTarget}
          onDismiss={dismissLayersIsland}
        />
        {localHost ? (
          <RunsIsland
            runs={agentRuns}
            capturing={captureActive}
            selectedFrameId={selectedFrameId}
            selectedElementId={selectedElementId}
            selectedAnnotationId={selectedAnnotationId}
          />
        ) : null}
        {selectedAnnotation && selectedAnnotationFrame && isReviewAnnotation(selectedAnnotation) ? (
          <AnnotationBloom
            annotation={selectedAnnotation}
            frame={selectedAnnotationFrame}
            frameAnnotations={document.annotations
              .filter((item) => item.frameId === selectedAnnotationFrame.id)
              .filter(isReviewAnnotation)}
            selectedFrameId={selectedFrameId}
            selectedElementId={selectedElementId}
            camera={document.camera}
            autoFocus={editorFocusId === selectedAnnotation.id}
            exportDelivered={exportStatus === 'delivered'}
            agentRun={selectedAnnotationAgentRun}
            resolved={resolvedAnnotationIds.has(selectedAnnotation.id) || isAnnotationResolved(selectedAnnotation)}
            onSaveDraft={saveInstructionDraft}
            onSetIntent={setSelectedAnnotationIntent}
            onDelete={deleteSelectedAnnotation}
            onResolve={() => {
              setResolvedAnnotationIds((current) => new Set([...current, selectedAnnotation.id]))
              updateDocument((current) => resolveBoardAnnotation(current, selectedAnnotation.id))
            }}
            dispatchAgents={localHost ? dispatchAgents ?? [] : null}
            dispatchAgent={dispatchAgent}
            onDispatch={(agent) => dispatchSingleAnnotation(selectedAnnotation.id, agent)}
            deliveryStatus={exportStatus}
          />
        ) : null}
        <LearnLensIsland
          open={learnLensOpen}
          frame={learnFrame}
          element={learnElement}
          content={learnContent}
          questionDraft={learnQuestionDraft}
          askedQuestion={learnAskedQuestion}
          answer={learnAnswer}
          asking={learnAsking}
          askError={learnAskError}
          canAsk
          pinned={learnPinnedElementId === learnElementId}
          onQuestionDraftChange={setLearnQuestionDraft}
          onAsk={() => { void askLearnQuestion() }}
          onPin={pinLearnAnswer}
          onClose={closeLearnLens}
        />
        <ReviewCommentsPanel
          document={document}
          selectedAnnotationId={selectedAnnotationId}
          selectedFrameId={selectedFrameId}
          selectedElementId={selectedElementId}
          copiedAnnotationId={copiedAnnotationId}
          poolCopyState={poolCopyState}
          onJump={jumpToAnnotation}
          onCopyAnnotation={copySingleComment}
          onCopyAll={copyAllComments}
          onExport={handleExport}
          dispatchAgents={localHost ? dispatchAgents ?? [] : null}
          dispatchAgent={dispatchAgent}
          onDispatchAgent={setDispatchAgent}
        />
      </div>
      <ReviewToolbar
        engine={engine}
        tool={tool}
        learnLensOpen={learnLensOpen}
        focused={focusedFrameId !== null}
        canFocus={selectedFrameId !== null}
        onTool={setTool}
        onToggleLearnLens={toggleLearnLens}
        onReset={handleReset}
        onFocusSelected={() => selectedFrameId && focusFrame(selectedFrameId)}
        onExitFocus={exitFocus}
        onImportImages={importImages}
        boardLabel={boardLabel}
      >
        {new URLSearchParams(window.location.search).get('dev') === '1' ? (
          <aside className="engine-switcher dm-island" aria-label="Canvas engine">
            <a className="dm-btn dm-btn--quiet dm-btn--sm" href="?engine=reactflow&dev=1" aria-current={engine === 'reactflow' ? 'page' : undefined}>React Flow</a>
            <a className="dm-btn dm-btn--quiet dm-btn--sm" href="?engine=excalidraw&dev=1" aria-current={engine === 'excalidraw' ? 'page' : undefined}>Excalidraw</a>
          </aside>
        ) : null}
        {localHost ? <a className="projects-link dm-btn dm-btn--quiet dm-btn--sm" href="/" data-testid="back-to-projects">Projects</a> : null}
      </ReviewToolbar>
      <div className="status-banners" data-testid="status-banners">
        {boardLoadError ? <p className="dm-notice" data-tone="error" role="alert" data-testid="board-load-error">{boardLoadError}</p> : null}
        {saveError ? (
          <p className="dm-notice" data-tone="error" role="alert" data-testid="board-save-error">
            {saveError}
            <button type="button" className="dm-notice-dismiss" onClick={clearSaveError} aria-label="Dismiss save error">×</button>
          </p>
        ) : null}
        {resetError ? (
          <p className="dm-notice" data-tone="error" role="alert" data-testid="board-reset-error">
            {resetError}
            <button type="button" className="dm-notice-dismiss" onClick={clearResetError} aria-label="Dismiss reset error">×</button>
          </p>
        ) : null}
        {boardUpdateWaiting && boardDirty ? (
          <p className="dm-notice" data-tone="info" role="status" data-testid="board-update-notice">
            An agent refreshed this board’s captures.
            <button
              type="button"
              className="dm-notice-action"
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
          <p className="dm-notice" data-tone="error" role="alert" data-testid="image-import-error">
            {importError}
            <button type="button" className="dm-notice-dismiss" onClick={() => setImportError(null)} aria-label="Dismiss import error">×</button>
          </p>
        ) : null}
        {sessionError ? (
          <p className="dm-notice" data-tone="error" role="alert" data-testid="live-session-error">
            {sessionError}
            <button type="button" className="dm-notice-dismiss" onClick={clearSessionError} aria-label="Dismiss live session error">×</button>
          </p>
        ) : null}
        {refreshError ? (
          <p className="dm-notice" data-tone="error" role="alert" data-testid="capture-refresh-error">
            {refreshError}
            <button type="button" className="dm-notice-dismiss" onClick={clearRefreshError} aria-label="Dismiss capture refresh error">×</button>
          </p>
        ) : null}
        {exportStatus === 'blocked' ? (
          <p className="dm-notice" data-tone="error" role="alert" data-testid="export-validation-error">
            {`Fix ${exportBlocks.length} annotation${exportBlocks.length === 1 ? '' : 's'} before export: `}
            {exportBlocks.map((block, index) => {
              const owner = document.annotations.find((item) => item.id === block.annotationId)
              const frame = document.frames.find((item) => item.id === owner?.frameId)
              return (
                <span key={block.annotationId}>
                  {index > 0 ? ', ' : ''}
                  <button type="button" className="dm-notice-action" onClick={() => jumpToAnnotation(block.annotationId)}>
                    {frame ? `${frame.label} (${block.annotationId})` : block.annotationId}
                  </button>
                </span>
              )
            })}
          </p>
        ) : null}
        {exportStatus === 'error' && exportDeliveryError ? (
          <p className="dm-notice" data-tone="error" role="alert" data-testid="export-delivery-error">
            {exportDeliveryError}
            <button type="button" className="dm-notice-dismiss" onClick={dismissDeliveryError} aria-label="Dismiss export error">×</button>
          </p>
        ) : null}
        {exportStatus === 'delivered' && exportedBatch ? (
          <p className="dm-notice" data-tone="success" role="status" data-testid="export-delivered-notice">
            {`Review batch delivered (${exportedBatch.annotations.length} annotation${exportedBatch.annotations.length === 1 ? '' : 's'}).`}
            <button type="button" className="dm-notice-action" data-testid="copy-review-batch" onClick={copyDeliveredBatch}>
              {batchCopyState === 'copied' ? 'Copied' : batchCopyState === 'failed' ? 'Copy failed, retry' : 'Copy JSON'}
            </button>
          </p>
        ) : null}
        {exportEmptyNotice ? (
          <p className="dm-notice" data-tone="info" role="status" data-testid="export-empty-notice">
            Nothing to export yet. Add an annotation with an instruction first.
            <button type="button" className="dm-notice-dismiss" onClick={() => setExportEmptyNotice(false)} aria-label="Dismiss export notice">×</button>
          </p>
        ) : null}
      </div>
      <ReviewBoardResetDialog
        open={resetDialogOpen}
        onCancel={cancelReset}
        onConfirm={handleConfirmReset}
      />
      <div className="board-status dm-island dm-status-island" role="status" data-testid="board-status">
        <span>{document.frames.length} screen{document.frames.length === 1 ? '' : 's'}</span>
        <span className="status-island-sep" aria-hidden="true">·</span>
        <span data-testid="annotation-count">
          {document.annotations.length} annotation{document.annotations.length === 1 ? '' : 's'}
        </span>
        <span className="status-island-sep" aria-hidden="true">·</span>
        <span className="dm-mono" aria-live="polite" data-testid="selected-frame">{selectedFrameId ?? 'none selected'}</span>
        <span className="status-island-sep" aria-hidden="true">·</span>
        <span className="dm-mono" aria-live="polite" data-testid="selected-annotation" title={selectedAnnotationId ?? undefined}>{selectedAnnotationOrdinal ? `#${selectedAnnotationOrdinal}` : 'none selected'}</span>
        <span className="status-island-sep" aria-hidden="true">·</span>
        <span className="dm-mono" data-testid="board-zoom">{zoomPercent}</span>
        <span className="status-island-sep" aria-hidden="true">·</span>
        {saveStateWord ? (
          <>
            <span role="status" data-testid="board-save-status">{saveStateWord === 'saving' ? 'Saving…' : 'Saved'}</span>
            <span className="status-island-sep" aria-hidden="true">·</span>
          </>
        ) : null}
        {exportStatus === 'delivered' ? (
          <>
            <span role="status" data-testid="export-status">Delivered</span>
            <span className="status-island-sep" aria-hidden="true">·</span>
          </>
        ) : null}
        <span className="dm-mono" aria-live="polite" data-testid="focus-state">{focusStateLabel}</span>
        <span className="status-island-sep" aria-hidden="true">·</span>
        <span className="dm-mono" data-testid="ready-ms">{readyMs === null ? 'measuring' : `${readyMs} ms`}</span>
        {learnLensOpen ? (
          <>
            <span className="status-island-sep" aria-hidden="true">·</span>
            <span role="status" data-testid="learn-lens-status">learn on</span>
          </>
        ) : null}
      </div>
      <output className="export-output" data-testid="export-output">
        {exportedBatch ? JSON.stringify(exportedBatch, null, 2) : ''}
      </output>
      <output className="board-diagnostics" data-testid="board-diagnostics">{serializeBoardDiagnostics(document)}</output>
    </div>
  )
}