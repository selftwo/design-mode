import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { boardsSemanticallyEqual } from '@/features/review-board/model/board-semantic-equality'
import { exportAgentAnnotation } from '@/features/review-board/model/export-agent-annotation'
import { applyUnitVerdict, type ApplyUnitVerdictResult } from '@/features/review-board/model/apply-unit-verdict'
import { ensureZonesForAllUnits } from '@/features/review-board/model/ensure-zones-for-unit'
import { buildReviewBatch, collectReviewBatchBlocks } from '@/features/review-board/model/review-batch'
import { copyReviewText } from '@/features/review-board/copy-review-text'
import { ReviewCommentsPanel, type PoolCopyState } from '@/features/review-board/ReviewCommentsPanel'
import { ReviewToolbar } from '@/features/review-board/ReviewToolbar'
import type { CanvasEngineProps, KillConfirmRequest } from '@/features/review-board/engines/canvas-engine'
import { readAllowedBoardHostOrigins } from '@/features/review-board/host/board-host-origin-config'
import { createWindowBoardHost } from '@/features/review-board/host/window-board-host'
import { ReviewBoardResetDialog } from '@/features/review-board/ReviewBoardResetDialog'
import type { AnnotationIntent, BoardDocument, EngineName, KitStateValue, ReviewAnnotation, ToolMode } from '@/features/review-board/model/board-document.schema'
import { serializeBoardDiagnostics } from '@/features/review-board/serialize-board-diagnostics'
import { useCaptureRefreshOnExit } from '@/features/review-board/use-capture-refresh-on-exit'
import { useLiveFrameSession } from '@/features/review-board/use-live-frame-session'
import { useReviewBatchExport } from '@/features/review-board/use-review-batch-export'
import { useReviewBoardHostLoad } from '@/features/review-board/use-review-board-host-load'
import { useReviewBoardPersistence } from '@/features/review-board/use-review-board-persistence'
import {
  createReviewTelemetry,
  kitStateSignature,
  recordKitState,
  recordPlayedLive,
  sampleVisibility,
  seedReviewTelemetry,
  toReviewSummaries,
  verdictReviewWarning,
  visibleFrameIds,
} from '@/features/review-board/model/review-telemetry'
import { buildUploadFrames, listImportableImageFiles, readImageFile } from '@/features/review-board/upload/import-image-frames'
import { ProtoLofiPanel } from '@/features/review-board/proto/ProtoLofiPanel'
import { buildProtoLofiBoard, isProtoLofiEnabled } from '@/features/review-board/proto/lofi-option-studio'
import { RunsIsland } from '@/features/local-host/RunsIsland'
import { DesignContextPane } from '@/features/local-host/DesignContextPane'
import { UnitQueueIsland } from '@/features/local-host/UnitQueueIsland'
import { LearnAskIsland } from '@/features/local-host/LearnAskIsland'
import { DecisionLedgerIsland } from '@/features/local-host/DecisionLedgerIsland'
import { VerdictConfirmBloom } from '@/features/review-board/VerdictConfirmBloom'
import { FrameKitIsland } from '@/features/playable-option/FrameKitIsland'
import type { PlayableInteractionMode } from '@/features/playable-option/PlayableOptionFrame'
import { HostProjectPicker } from '@/features/local-host/HostProjectPicker'
import { createLocalHostClient } from '@/features/local-host/local-host-client'
import { activeProjectIdFromLocation, isServedByLocalHost } from '@/features/local-host/local-host-detection'
import { useAgentCollaboration } from '@/features/local-host/use-agent-collaboration'
import type { AgentId } from '@/features/local-host/host-api.schema'

const ReactFlowReviewBoard = lazy(() => import('@/features/review-board/engines/react-flow/ReactFlowReviewBoard'))
const ExcalidrawReviewBoard = lazy(() => import('@/features/review-board/engines/excalidraw/ExcalidrawReviewBoard'))

const AUTOSAVE_DELAY_MS = 600

function selectedEngine(): EngineName {
  return new URLSearchParams(window.location.search).get('engine') === 'excalidraw'
    ? 'excalidraw'
    : 'reactflow'
}

// A verdict is only offered on an active option of an open unit, so these
// rejections mean the board changed under the gesture (a reload or a race). The
// message tells the reviewer to take a fresh look rather than retry blindly.
function verdictErrorMessage(reason: Exclude<ApplyUnitVerdictResult, { ok: true }>['reason']): string {
  switch (reason) {
    case 'empty-summary':
      return 'A verdict needs a one-line summary.'
    case 'unit-locked':
      return 'This unit is already decided.'
    case 'frame-not-active':
    case 'not-an-option':
      return 'This option is no longer open for a verdict.'
    default:
      return 'This verdict could not be recorded.'
  }
}

export default function App() {
  const engine = useMemo(selectedEngine, [])
  // THROWAWAY prototype (Item 1, docs/plans/canvas-lofi-option-studio-2026-07-21.md):
  // behind ?proto=lofi, seed the board with hardcoded lo-fi options to feel the loop.
  const protoLofi = useMemo(() => (isProtoLofiEnabled() ? buildProtoLofiBoard() : null), [])
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
  const [verdictError, setVerdictError] = useState<string | null>(null)
  const [pendingKillDrag, setPendingKillDrag] = useState<KillConfirmRequest | null>(null)
  // The active unit in the queue. Lifted here so a dropped image links to it and
  // a verdict can offer its references. Kept pointing at a real unit below.
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [dispatchAgent, setDispatchAgent] = useState<AgentId>('claude')
  const [preferredOptionId, setPreferredOptionId] = useState<string | null>(null)
  // Per-frame play/review mode for playable options. In memory only; never saved.
  const [playableFrameModes, setPlayableFrameModes] = useState<Record<string, PlayableInteractionMode>>({})
  // Review telemetry (item 6). The accumulator lives in memory; its totals flush
  // into the board on a coarse cadence and on page hide. The view sample is the
  // latest raw viewport the engine reported, used to derive visible frames.
  const telemetryRef = useRef(createReviewTelemetry())
  const viewSampleRef = useRef<{ view: { x: number; y: number; zoom: number }; canvasSize: { width: number; height: number } } | null>(null)
  const seededBoardIdRef = useRef<string | null>(null)
  const documentRef = useRef<BoardDocument | null>(null)
  const [readyMs, setReadyMs] = useState<number | null>(null)
  const boardStorage = localHost?.boardStorage
  const {
    lastSaved,
    saveStatus,
    saveError,
    resetDialogOpen,
    resetError,
    setBaseline,
    acknowledgeBoardPatch,
    save: persistBoard,
    saveImmediately,
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
    setPlayableFrameModes({})
  })

  const updateDocument: CanvasEngineProps['onDocumentChange'] = useCallback((update) => {
    setDocument((current) => {
      if (!current) return current
      return typeof update === 'function' ? update(current) : update
    })
  }, [setDocument])

  const setPlayableFrameMode = useCallback((frameId: string, mode: PlayableInteractionMode) => {
    // Putting an option into play mode is the act of playing it live; record it
    // for review telemetry so an unplayed winner can be flagged at verdict time.
    if (mode === 'play') telemetryRef.current = recordPlayedLive(telemetryRef.current, frameId)
    setPlayableFrameModes((current) => ({ ...current, [frameId]: mode }))
  }, [])

  // Keep the active unit pointing at a real unit: fall back to the first one, or
  // nothing when the board has none. Mirrors the old in-island selection guard.
  useEffect(() => {
    const units = document?.units ?? []
    setSelectedUnitId((current) => (current && units.some((unit) => unit.id === current) ? current : units[0]?.id ?? null))
  }, [document?.units])

  // A kit control edit, written immutably into the frame's saved kit state. The
  // value is checked against its control so the board stays relation-valid; an
  // unchanged value is a no-op. Autosave then persists it; the change is
  // frame-local.
  const setKitControlValue = useCallback((frameId: string, controlId: string, value: KitStateValue) => {
    updateDocument((current) => {
      const frame = current.frames.find((item) => item.id === frameId)
      if (!frame || frame.kind !== 'playable-option' || !frame.kit) return current
      const control = frame.kit.manifest.controls.find((item) => item.id === controlId)
      if (!control) return current
      if (control.kind === 'toggle' && typeof value !== 'boolean') return current
      if (control.kind === 'choice' && (typeof value !== 'string' || !control.options.some((option) => option.value === value))) return current
      if (frame.kit.state[controlId] === value) return current
      const nextFrame = { ...frame, kit: { ...frame.kit, state: { ...frame.kit.state, [controlId]: value } } }
      // Record the kit state the reviewer landed on. Dedup by signature keeps a
      // repeat (including a strict-mode double invoke) from counting twice.
      telemetryRef.current = recordKitState(telemetryRef.current, frameId, kitStateSignature(nextFrame.kit.state))
      return { ...current, frames: current.frames.map((item) => item.id === frameId ? nextFrame : item) }
    })
  }, [updateDocument])

  // Keep a ref to the live document so the telemetry interval reads the latest
  // frames without re-subscribing every edit.
  useEffect(() => { documentRef.current = document }, [document])

  // Seed the telemetry accumulator from a freshly loaded board so a reload keeps
  // prior review traces. Guarded by board id so ordinary edits do not reseed.
  useEffect(() => {
    if (!document || seededBoardIdRef.current === document.boardId) return
    seededBoardIdRef.current = document.boardId
    telemetryRef.current = seedReviewTelemetry(document.reviewSummaries)
  }, [document])

  // Flush the accumulated totals into the board when they changed, so autosave
  // persists them and the host prompt can read them. Pruned to frames still on
  // the board.
  const flushTelemetry = useCallback((): BoardDocument | null => {
    const current = documentRef.current
    if (!current) return null
    const summaries = toReviewSummaries(telemetryRef.current, current.frames.map((frame) => frame.id))
    if (JSON.stringify(summaries) === JSON.stringify(current.reviewSummaries)) return null
    updateDocument((doc) => ({ ...doc, reviewSummaries: summaries }))
    return { ...current, reviewSummaries: summaries }
  }, [updateDocument])

  // The heartbeat: integrate dwell each second from the latest viewport sample,
  // and flush every few seconds. One stable interval; document is read via ref.
  useEffect(() => {
    let sinceFlush = 0
    const tick = () => {
      const doc = documentRef.current
      const sample = viewSampleRef.current
      const ids = doc && sample ? visibleFrameIds(doc.frames, sample.view, sample.canvasSize) : []
      telemetryRef.current = sampleVisibility(telemetryRef.current, {
        nowMs: Date.now(),
        visibleFrameIds: ids,
        pageVisible: typeof globalThis.document !== 'undefined' ? !globalThis.document.hidden : true,
      })
      sinceFlush += 1
      if (sinceFlush >= 5) { sinceFlush = 0; flushTelemetry() }
    }
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [flushTelemetry])

  // On page hide, close the current dwell span, flush, and persist directly:
  // summaries do not mark the board dirty (see board-semantic-equality), so
  // autosave never picks up a telemetry-only change, and a closing tab has no
  // later chance to save.
  useEffect(() => {
    const onHide = () => {
      if (globalThis.document.visibilityState !== 'hidden') return
      telemetryRef.current = sampleVisibility(telemetryRef.current, { nowMs: Date.now(), visibleFrameIds: [], pageVisible: false })
      const flushed = flushTelemetry()
      if (flushed && !saveError) persistBoard(flushed)
    }
    globalThis.document.addEventListener('visibilitychange', onHide)
    return () => globalThis.document.removeEventListener('visibilitychange', onHide)
  }, [flushTelemetry, persistBoard, saveError])

  const recordViewportSample: NonNullable<CanvasEngineProps['onViewportSample']> = useCallback((view, canvasSize) => {
    viewSampleRef.current = { view, canvasSize }
  }, [])

  const {
    refreshError,
    refreshing,
    refreshingFrameId,
    requestExitRefresh,
    cancelPendingRefresh,
    clearRefreshError,
    bindDocument,
  } = useCaptureRefreshOnExit(host, updateDocument)

  // An identity that only changes when reviewer-visible content changes, so the
  // notices below survive a telemetry-only flush (which replaces the document
  // object every few seconds without changing anything the reviewer did).
  const prevSemanticDocumentRef = useRef<BoardDocument | null>(null)
  const semanticDocument = useMemo(() => {
    const previous = prevSemanticDocumentRef.current
    if (document && previous && boardsSemanticallyEqual(document, previous)) return previous
    prevSemanticDocumentRef.current = document
    return document
  }, [document])

  // A delivered batch describes a moment in time: editing the board afterwards makes it stale.
  useEffect(() => {
    acknowledgeDelivery()
  }, [semanticDocument, acknowledgeDelivery])

  useEffect(() => {
    setBatchCopyState('idle')
  }, [exportStatus, exportedBatch])

  useEffect(() => {
    setPoolCopyState('idle')
    setCopiedAnnotationId(null)
  }, [semanticDocument])

  // Drop play/review modes for frames that left the board, so the map never
  // grows unbounded or points at gone frames.
  useEffect(() => {
    if (!document) return
    const ids = new Set(document.frames.map((frame) => frame.id))
    setPlayableFrameModes((current) => {
      const kept = Object.entries(current).filter(([id]) => ids.has(id))
      return kept.length === Object.keys(current).length ? current : Object.fromEntries(kept)
    })
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

  // THROWAWAY prototype: with no host to send a board, seed the lo-fi options once.
  useEffect(() => {
    if (!protoLofi || document) return
    setDocument(protoLofi.document)
    setBaseline(protoLofi.document)
  }, [protoLofi, document, setDocument, setBaseline])

  // A teach answer to one of our asks: open it at its anchor so the reviewer
  // sees the pinned note the moment it lands.
  const openLearnAnswer = useCallback((annotation: ReviewAnnotation) => {
    setSelectedFrameId(annotation.frameId)
    setSelectedAnnotationId(annotation.id)
  }, [])

  const {
    dispatchAgents,
    agentRuns,
    captureActive,
    boardUpdateWaiting,
    acknowledgeBoardUpdate,
    hostConnection,
    learnPendingCount,
    learnAsking,
    learnError,
    askLearn,
    dismissLearnError,
  } = useAgentCollaboration({
    localHost,
    setDocument,
    acknowledgeBoardPatch,
    onLearnAnswer: openLearnAnswer,
  })

  useEffect(() => {
    localHost?.setDispatchAgent(dispatchAgent)
  }, [localHost, dispatchAgent])

  useEffect(() => {
    if (!boardUpdateWaiting || !localHost || boardDirty) return
    acknowledgeBoardUpdate()
    host.requestBoard()
  }, [boardUpdateWaiting, localHost, boardDirty, host, acknowledgeBoardUpdate])

  const handleCanvasReady = useCallback(() => {
    requestAnimationFrame(() => setReadyMs((current) => current ?? Math.round(performance.now())))
  }, [])

  const focusFrame = (frameId: string) => {
    setSelectedFrameId(frameId)
    setSelectedAnnotationId(null)
    setTool('select')
    // Only captured routes use the project-route live session. Playable options
    // mount their own iframe through the board engine's play/review mode instead.
    const frame = document?.frames.find((item) => item.id === frameId)
    if (frame?.kind === 'captured-route') beginLiveSession(frameId)
  }

  // A confirmed stamp or strike. The verdict is applied to the whole document and
  // saved immediately through compare-and-save, so a decision reaches the host as
  // soon as it is made. The local row is kept even if the save fails (the save
  // error banner surfaces the failure, including revision conflicts).
  const confirmVerdict = (
    frameId: string,
    kind: 'promote' | 'kill',
    summary: string,
    referenceFrameIds: string[] = [],
    placement?: { x: number; y: number },
  ) => {
    const frame = document?.frames.find((item) => item.id === frameId)
    if (!frame?.unitId) return
    const result = applyUnitVerdict(document!, {
      unitId: frame.unitId,
      frameId,
      kind,
      summary,
      referenceFrameIds,
      placement,
    })
    if (!result.ok) {
      setVerdictError(verdictErrorMessage(result.reason))
      return
    }
    setVerdictError(null)
    setPendingKillDrag(null)
    updateDocument(result.document)
    void saveImmediately(result.document)
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
    // Legacy boards may predate per-unit zones; backfill so drag targets exist.
    resetLoadedBoard(ensureZonesForAllUnits(board))
    setSelectedFrameId(null)
    setSelectedAnnotationId(null)
    clearLiveSession()
    resetExportState()
    setExportEmptyNotice(false)
    setTool('select')
    setPlayableFrameModes({})
  }, [cancelPendingRefresh, clearLiveSession, resetLoadedBoard, resetExportState])

  const handleReset = () => {
    if (!hostBoard || !document) return
    const outcome = requestReset(document, hostBoard)
    if (!outcome?.immediate) return
    void applyImmediateReset(hostBoard).then((result) => {
      if (result.ok) applyHostBoard(result.hostBoard)
    })
  }

  const handleConfirmReset = () => {
    if (!hostBoard) return
    void confirmReset(hostBoard).then((result) => {
      if (result.ok) applyHostBoard(result.hostBoard)
    })
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
      const frames = buildUploadFrames(document, images, { unitId: selectedUnitId ?? undefined })
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
  }, [document, selectedUnitId, updateDocument])

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
  const selectedFrame = selectedFrameId ? document.frames.find((frame) => frame.id === selectedFrameId) ?? null : null
  const kitFrame = engine === 'reactflow'
    && selectedFrame?.kind === 'playable-option'
    && selectedFrame.kit
    && (selectedFrame.lifeState === 'active' || selectedFrame.lifeState === 'locked')
    ? selectedFrame
    : null

  const canvasProps: CanvasEngineProps = {
    document,
    tool,
    focusedFrameId,
    liveFrameConfig,
    selectedFrameId,
    selectedAnnotationId,
    editorFocusId,
    playableFrameModes,
    onDocumentChange: updateDocument,
    onFocusFrame: focusFrame,
    onSelectFrame: setSelectedFrameId,
    onSelectAnnotation: handleSelectAnnotation,
    onAnnotationCreated: handleAnnotationCreated,
    onSaveAnnotationDraft: saveInstructionDraft,
    onSetAnnotationIntent: setSelectedAnnotationIntent,
    onDeleteAnnotation: deleteSelectedAnnotation,
    onRequestKillConfirm: setPendingKillDrag,
    onViewportSample: recordViewportSample,
    onReady: handleCanvasReady,
  }
  const Canvas = engine === 'reactflow' ? ReactFlowReviewBoard : ExcalidrawReviewBoard
  const pendingKillFrame = pendingKillDrag
    ? document.frames.find((frame) => frame.id === pendingKillDrag.frameId) ?? null
    : null
  // The references a verdict on a unit's option can link, all pre-selected in the
  // confirm bloom. A frame with no unit has none.
  const referencesForUnit = (unitId: string | undefined) => (unitId
    ? document.frames
      .filter((frame) => frame.kind === 'reference-image' && frame.unitId === unitId)
      .map((frame) => ({ id: frame.id, label: frame.label }))
    : [])

  return (
    <div className="app-shell">
      <ReviewToolbar
        engine={engine}
        tool={tool}
        focused={focusedFrameId !== null}
        canFocus={selectedFrame?.kind === 'captured-route'}
        onTool={setTool}
        onReset={handleReset}
        onFocusSelected={() => selectedFrameId && focusFrame(selectedFrameId)}
        onExitFocus={exitFocus}
        onImportImages={importImages}
      >
        <aside className="engine-switcher" aria-label="Canvas engine">
          <a href="?engine=reactflow" aria-current={engine === 'reactflow' ? 'page' : undefined}>React Flow</a>
          <a href="?engine=excalidraw" aria-current={engine === 'excalidraw' ? 'page' : undefined}>Excalidraw</a>
          <a href="?proto=lofi" aria-current={protoLofi ? 'page' : undefined} data-testid="proto-lofi-link">Lo-fi proto</a>
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
        {localHost ? (
          <UnitQueueIsland
            document={document}
            client={localHost}
            selectedUnitId={selectedUnitId}
            onSelectUnit={setSelectedUnitId}
            onDocumentChange={(next) => updateDocument(next)}
            onSaveImmediately={saveImmediately}
          />
        ) : null}
        {localHost ? <RunsIsland runs={agentRuns} capturing={captureActive} /> : null}
        {localHost && selectedFrame ? (
          <LearnAskIsland
            frameLabel={selectedFrame.label}
            asking={learnAsking}
            pending={learnPendingCount}
            error={learnError}
            onAsk={(question) => askLearn(selectedFrame.id, question)}
            onDismissError={dismissLearnError}
          />
        ) : null}
        {kitFrame ? (
          <FrameKitIsland
            frame={kitFrame}
            mode={playableFrameModes[kitFrame.id] ?? 'review'}
            canVerdict={kitFrame.lifeState === 'active'
              && document.units.find((unit) => unit.id === kitFrame.unitId)?.state === 'open'}
            references={referencesForUnit(kitFrame.unitId)}
            reviewSummary={document.reviewSummaries.find((summary) => summary.frameId === kitFrame.id)}
            promoteWarning={kitFrame.unitId
              ? verdictReviewWarning(document.frames, document.reviewSummaries, kitFrame.unitId, kitFrame.id)
              : null}
            onModeChange={(mode) => setPlayableFrameMode(kitFrame.id, mode)}
            onKitControlChange={(controlId, value) => setKitControlValue(kitFrame.id, controlId, value)}
            onVerdict={(kind, summary, referenceFrameIds) => confirmVerdict(kitFrame.id, kind, summary, referenceFrameIds)}
          />
        ) : null}
        {pendingKillFrame && pendingKillDrag ? (
          <div className="drag-kill-bloom" data-testid="drag-kill-bloom">
            <VerdictConfirmBloom
              kind="kill"
              frameLabel={pendingKillFrame.label}
              references={referencesForUnit(pendingKillFrame.unitId)}
              onConfirm={(summary, referenceFrameIds) => confirmVerdict(
                pendingKillDrag.frameId,
                'kill',
                summary,
                referenceFrameIds,
                pendingKillDrag.dropPosition,
              )}
              onCancel={() => setPendingKillDrag(null)}
            />
          </div>
        ) : null}
        {document.verdicts.length > 0 ? <DecisionLedgerIsland document={document} /> : null}
        {protoLofi ? (
          <ProtoLofiPanel
            document={document}
            optionHtml={protoLofi.optionHtml}
            preferredFrameId={preferredOptionId}
            onPrefer={setPreferredOptionId}
            onSelectFrame={setSelectedFrameId}
          />
        ) : null}
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
        {localHost && hostConnection === 'reconnecting' ? (
          <p className="host-connection-notice export-empty-notice" role="status" data-testid="host-connection-notice">
            Host connection lost, reconnecting…
          </p>
        ) : null}
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
                acknowledgeBoardUpdate()
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
        {verdictError ? (
          <p className="verdict-error" role="alert" data-testid="verdict-error">
            {verdictError}
            <button type="button" className="banner-dismiss" onClick={() => setVerdictError(null)} aria-label="Dismiss verdict error">×</button>
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