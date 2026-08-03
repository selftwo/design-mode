import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CaptureUpdateAction,
  Excalidraw,
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { NormalizedPoint, ReviewAnnotation } from '../../model/board-document.schema'
import { containingFrame, normalizeLocalPoint } from '../../model/board-geometry'
import type { CanvasEngineProps } from '../canvas-engine'
import { LiveFrameHostConnecting } from '@/features/live-review/LiveFrameHostConnecting'
import { LiveReviewFrame } from '@/features/live-review/LiveReviewFrame'
import {
  frameIdFromElement,
  mergeSceneFrames,
  projectDocument,
  projectFiles,
  sceneDiagnostics,
} from './project-board-to-excalidraw'

const excalidrawUiOptions = {
  canvasActions: {
    loadScene: false,
    saveToActiveFile: false,
    export: false,
    clearCanvas: false,
  },
} as const

function semanticFingerprint(document: CanvasEngineProps['document']): string {
  return JSON.stringify({
    frames: document.frames.map(({ id, x, y, width, height, revision }) => ({ id, x, y, width, height, revision })),
    annotations: document.annotations,
  })
}

export default function ExcalidrawReviewBoard({
  document,
  tool,
  learnLensOpen: _learnLensOpen,
  focusedFrameId,
  liveFrameConfig,
  selectedFrameId: _selectedFrameId,
  selectedElementId: _selectedElementId,
  selectedAnnotationId: _selectedAnnotationId,
  pendingJumpAnnotationId: _pendingJumpAnnotationId,
  outlinedTarget: _outlinedTarget,
  resolvedAnnotationIds: _resolvedAnnotationIds,
  onDocumentChange,
  onFocusFrame: _onFocusFrame,
  onSelectFrame,
  onSelectElement: _onSelectElement,
  onLearnElementPick: _onLearnElementPick,
  onSelectAnnotation: _onSelectAnnotation,
  onAnnotationCreated: _onAnnotationCreated,
  onDeleteTeachAnnotation: _onDeleteTeachAnnotation,
  onResolveTeachAnnotation: _onResolveTeachAnnotation,
  onJumpHandled: _onJumpHandled,
  onReady,
}: CanvasEngineProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const [viewState, setViewState] = useState<{
    scrollX: number
    scrollY: number
    zoom: number
    selectedId: string | null
  } | null>(null)
  const [elements, setElements] = useState<readonly ExcalidrawElement[]>([])
  const drawStart = useRef<{ frameId: string; point: NormalizedPoint } | null>(null)
  const lastApplied = useRef('')
  const initialDocument = useRef(document)
  const initialData = useMemo(() => ({
    elements: projectDocument(initialDocument.current),
    files: projectFiles(initialDocument.current),
    appState: {
      scrollX: -initialDocument.current.camera.worldX,
      scrollY: -initialDocument.current.camera.worldY,
      zoom: { value: initialDocument.current.camera.zoom as AppState['zoom']['value'] },
      viewBackgroundColor: '#f5f6fa',
    },
  }), [])

  useEffect(() => {
    if (!api) return
    const fingerprint = semanticFingerprint(document)
    if (lastApplied.current === fingerprint) return
    lastApplied.current = fingerprint
    const files = projectFiles(document)
    api.addFiles(Object.values(files))
    api.updateScene({
      elements: projectDocument(document),
      appState: {
        selectedElementIds: {},
        selectedGroupIds: {},
        editingGroupId: null,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    })
  }, [api, document])

  const handleChange = useCallback((nextElements: readonly ExcalidrawElement[], nextAppState: AppState) => {
    setElements(nextElements)
    const selectedId = Object.keys(nextAppState.selectedElementIds)[0]
    setViewState((current) => {
      const next = {
        scrollX: nextAppState.scrollX,
        scrollY: nextAppState.scrollY,
        zoom: nextAppState.zoom.value,
        selectedId: selectedId ?? null,
      }
      if (
        current
        && current.scrollX === next.scrollX
        && current.scrollY === next.scrollY
        && current.zoom === next.zoom
        && current.selectedId === next.selectedId
      ) return current
      return next
    })
    const selected = selectedId ? nextElements.find((element) => element.id === selectedId) : null
    onSelectFrame(selected ? frameIdFromElement(selected) : null)

    onDocumentChange((current) => {
      const nextDocument = mergeSceneFrames(current, nextElements)
      if (nextDocument !== current) lastApplied.current = semanticFingerprint(nextDocument)
      return nextDocument
    })
  }, [onDocumentChange, onSelectFrame])

  const scenePoint = useCallback((event: React.PointerEvent) => {
    if (!api) return null
    return viewportCoordsToSceneCoords(
      { clientX: event.clientX, clientY: event.clientY },
      api.getAppState(),
    )
  }, [api])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const world = scenePoint(event)
    if (!world) return
    const frame = containingFrame(document.frames, world)
    if (!frame) return
    drawStart.current = {
      frameId: frame.id,
      point: normalizeLocalPoint([world.x - frame.x, world.y - frame.y], frame.width, frame.height),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }, [document.frames, scenePoint])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const start = drawStart.current
    drawStart.current = null
    const world = scenePoint(event)
    if (!start || !world) return
    const frame = document.frames.find((item) => item.id === start.frameId)
    if (!frame) return
    const end = normalizeLocalPoint([world.x - frame.x, world.y - frame.y], frame.width, frame.height)
    onDocumentChange((current) => {
      const currentFrame = current.frames.find((item) => item.id === frame.id)
      if (!currentFrame) return current
      const annotation: ReviewAnnotation = {
        kind: 'review',
        id: crypto.randomUUID(),
        frameId: frame.id,
        status: 'draft',
        instruction: tool === 'circle' ? 'Review the circled area.' : 'Review this point.',
        anchor: tool === 'circle'
          ? [(start.point[0] + end[0]) / 2, (start.point[1] + end[1]) / 2]
          : start.point,
        mark: tool === 'circle' ? { kind: 'circle', points: [start.point, end] } : null,
        createdAt: new Date().toISOString(),
        madeAgainstCaptureHash: currentFrame.captureHash,
        madeAgainstRevision: currentFrame.revision,
      }
      return { ...current, annotations: [...current.annotations, annotation] }
    })
    event.preventDefault()
  }, [document, onDocumentChange, scenePoint, tool])

  const selectedFrame = useMemo(() => {
    if (!viewState) return null
    const selected = viewState.selectedId ? elements.find((element) => element.id === viewState.selectedId) : null
    const frameId = selected ? frameIdFromElement(selected) : null
    return frameId ? document.frames.find((frame) => frame.id === frameId) ?? null : null
  }, [document.frames, elements, viewState])

  const selectionRect = useMemo(() => {
    if (!selectedFrame || !viewState || !api) return null
    const topLeft = sceneCoordsToViewportCoords(
      { sceneX: selectedFrame.x, sceneY: selectedFrame.y },
      api.getAppState(),
    )
    const currentAppState = api.getAppState()
    return {
      left: topLeft.x - currentAppState.offsetLeft,
      top: topLeft.y - currentAppState.offsetTop,
      width: selectedFrame.width * viewState.zoom,
      height: selectedFrame.height * viewState.zoom,
    }
  }, [api, selectedFrame, viewState])

  const handleScrollChange = useCallback((scrollX: number, scrollY: number, zoom: AppState['zoom']) => {
    onDocumentChange((current) => {
      if (
        Math.abs(current.camera.worldX + scrollX) < 0.001
        && Math.abs(current.camera.worldY + scrollY) < 0.001
        && Math.abs(current.camera.zoom - zoom.value) < 0.001
      ) return current
      return {
        ...current,
        camera: { worldX: -scrollX, worldY: -scrollY, zoom: zoom.value },
      }
    })
  }, [onDocumentChange])

  const handleApi = useCallback((nextApi: ExcalidrawImperativeAPI) => {
    setApi(nextApi)
    requestAnimationFrame(onReady)
  }, [onReady])

  return (
    <main className="canvas-shell excalidraw-shell" data-testid="excalidraw-canvas" data-live-mode="overlay-fallback">
      <Excalidraw
        initialData={initialData}
        excalidrawAPI={handleApi}
        onChange={handleChange}
        onScrollChange={handleScrollChange}
        UIOptions={excalidrawUiOptions}
      />
      <div
        className={`excal-pointer-layer ${tool === 'select' ? '' : 'active'}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        data-testid="excal-pointer-layer"
      />
      {selectionRect && tool === 'select' ? (
        <div className="excal-selection" style={selectionRect} data-testid="excal-selection" />
      ) : null}
      {focusedFrameId ? (
        <div className="excal-live-overlay" data-testid="excal-live-overlay">
          <p>Excalidraw requires a fixed live view outside its rendered scene.</p>
          {liveFrameConfig ? (
            <LiveReviewFrame config={liveFrameConfig} />
          ) : (
            <LiveFrameHostConnecting frameId={focusedFrameId} />
          )}
        </div>
      ) : null}
      <output className="scene-diagnostics" data-testid="excal-scene-diagnostics">
        {JSON.stringify(sceneDiagnostics(elements))}
      </output>
    </main>
  )
}
