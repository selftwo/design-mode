import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  applyNodeChanges,
  useNodesState,
  type Node,
  type NodeChange,
  type OnMove,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { FrameElement, NormalizedPoint } from '../../model/board-document.schema'
import { normalizedPathBounds, resizeFrameAspectLocked } from '../../model/board-geometry'
import {
  classifyFrameDragStop,
  moveFrameToArchiveZone,
  repositionFrame,
  restoreFrameFromZone,
} from '../../model/move-frame-to-zone'
import { pickAnnotationAtClientPoint } from '../../model/pick-annotation-at-point'
import { selectLivePlayableFrameIds } from '@/features/playable-option/playable-option-mount-policy'
import type { CanvasEngineProps } from '../canvas-engine'
import { BoardZoneNode, type BoardZoneNodeData } from './BoardZoneNode'
import { ScreenFrameNode, type ScreenFrameNodeData } from './ScreenFrameNode'

type ReviewFlowNode =
  | Node<ScreenFrameNodeData, 'screen'>
  | Node<BoardZoneNodeData, 'boardZone'>

const nodeTypes = { screen: ScreenFrameNode, boardZone: BoardZoneNode }

const ARROW_KEY_DELTAS: Record<string, readonly [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
}

const MINIMUM_CIRCLE_EXTENT = 0.02
const COLLAPSED_ZONE_HEIGHT = 88

function inflateToMinimumExtent(start: NormalizedPoint, end: NormalizedPoint): [NormalizedPoint, NormalizedPoint] {
  const axis = (a: number, b: number): [number, number] => {
    if (Math.abs(b - a) >= MINIMUM_CIRCLE_EXTENT) return [a, b]
    const center = Math.min(Math.max((a + b) / 2, MINIMUM_CIRCLE_EXTENT / 2), 1 - MINIMUM_CIRCLE_EXTENT / 2)
    return [center - MINIMUM_CIRCLE_EXTENT / 2, center + MINIMUM_CIRCLE_EXTENT / 2]
  }
  const [x1, x2] = axis(start[0], end[0])
  const [y1, y2] = axis(start[1], end[1])
  return [[x1, y1], [x2, y2]]
}

function documentViewport(document: CanvasEngineProps['document']): Viewport {
  return {
    x: -document.camera.worldX * document.camera.zoom,
    y: -document.camera.worldY * document.camera.zoom,
    zoom: document.camera.zoom,
  }
}

export default function ReactFlowReviewBoard({
  document,
  tool,
  focusedFrameId,
  liveFrameConfig,
  selectedFrameId,
  selectedAnnotationId,
  playableFrameModes,
  onDocumentChange,
  onFocusFrame,
  onSelectFrame,
  onSelectAnnotation,
  onAnnotationCreated,
  onRequestKillConfirm,
  onViewportSample,
  onReady,
}: CanvasEngineProps) {
  // Live iframes mount only for the active set (visible plus one screen of
  // margin, capped). That needs the current viewport and canvas pixel size,
  // tracked in memory here and never saved to the board.
  const canvasShellRef = useRef<HTMLElement>(null)
  const [liveViewport, setLiveViewport] = useState<Viewport>(() => documentViewport(document))
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const pendingViewportRef = useRef<Viewport | null>(null)
  const viewportFrameRef = useRef<number | null>(null)
  const dragOriginRef = useRef<{ frameId: string; x: number; y: number } | null>(null)

  useEffect(() => {
    const shell = canvasShellRef.current
    if (!shell) return
    const measure = () => setCanvasSize({ width: shell.clientWidth, height: shell.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(shell)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => {
    if (viewportFrameRef.current !== null) cancelAnimationFrame(viewportFrameRef.current)
  }, [])

  // Report the raw viewport and canvas size for review telemetry. App derives the
  // visible frames from these with the pure accumulator, so nothing about
  // visibility math lives in the engine.
  useEffect(() => {
    onViewportSample?.({ x: liveViewport.x, y: liveViewport.y, zoom: liveViewport.zoom }, canvasSize)
  }, [onViewportSample, liveViewport, canvasSize])

  // Feeding the current set back in keeps mounted iframes sticky at ties and,
  // when membership is unchanged, keeps the same Set identity, so a viewport
  // tick during panning does not rebuild (and re-render) every canvas node.
  const liveEligibleRef = useRef<Set<string>>(new Set())
  const liveEligibleIds = useMemo(() => {
    const next = selectLivePlayableFrameIds({
      frames: document.frames,
      view: liveViewport,
      canvasSize,
      selectedFrameId,
      focusedFrameId,
      mountedIds: liveEligibleRef.current,
    })
    liveEligibleRef.current = next
    return next
  }, [document.frames, liveViewport, canvasSize, selectedFrameId, focusedFrameId])

  const addCircle = useCallback((frameId: string, start: NormalizedPoint, end: NormalizedPoint) => {
    const frame = document.frames.find((item) => item.id === frameId)
    if (!frame) return
    // A click without a drag would create an invisible zero-size ellipse.
    const [markStart, markEnd] = inflateToMinimumExtent(start, end)
    onAnnotationCreated({
      id: crypto.randomUUID(),
      frameId,
      role: 'review',
      status: 'draft',
      instruction: '',
      anchor: [(markStart[0] + markEnd[0]) / 2, (markStart[1] + markEnd[1]) / 2],
      mark: { kind: 'circle', points: [markStart, markEnd] },
      createdAt: new Date().toISOString(),
      madeAgainstCaptureHash: frame.captureHash,
      madeAgainstRevision: frame.revision,
    })
  }, [document.frames, onAnnotationCreated])

  const addPath = useCallback((frameId: string, points: NormalizedPoint[]) => {
    const frame = document.frames.find((item) => item.id === frameId)
    if (!frame) return
    const [start, end] = normalizedPathBounds(points)
    onAnnotationCreated({
      id: crypto.randomUUID(),
      frameId,
      role: 'review',
      status: 'draft',
      instruction: '',
      anchor: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
      mark: { kind: 'path', points },
      createdAt: new Date().toISOString(),
      madeAgainstCaptureHash: frame.captureHash,
      madeAgainstRevision: frame.revision,
    })
  }, [document.frames, onAnnotationCreated])

  const pickElement = useCallback((frameId: string, element: FrameElement) => {
    // One annotation per design element: picking it again returns to the note.
    const existing = document.annotations.find((annotation) => annotation.frameId === frameId
      && annotation.mark?.kind === 'element'
      && annotation.mark.elementId === element.id)
    if (existing) {
      onSelectAnnotation(existing.id)
      return
    }
    const frame = document.frames.find((item) => item.id === frameId)
    if (!frame) return
    const [start, end] = element.bounds
    onAnnotationCreated({
      id: crypto.randomUUID(),
      frameId,
      role: 'review',
      status: 'draft',
      instruction: '',
      anchor: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
      mark: { kind: 'element', elementId: element.id, label: element.label, points: element.bounds },
      createdAt: new Date().toISOString(),
      madeAgainstCaptureHash: frame.captureHash,
      madeAgainstRevision: frame.revision,
    })
  }, [document.annotations, document.frames, onAnnotationCreated, onSelectAnnotation])

  const addComment = useCallback((frameId: string, anchor: NormalizedPoint) => {
    const frame = document.frames.find((item) => item.id === frameId)
    if (!frame) return
    onAnnotationCreated({
      id: crypto.randomUUID(),
      frameId,
      role: 'review',
      status: 'draft',
      instruction: '',
      anchor,
      mark: null,
      createdAt: new Date().toISOString(),
      madeAgainstCaptureHash: frame.captureHash,
      madeAgainstRevision: frame.revision,
    })
  }, [document.frames, onAnnotationCreated])

  const resizeFrame = useCallback((frameId: string, width: number) => {
    onDocumentChange((current) => ({
      ...current,
      frames: current.frames.map((frame) => frame.id === frameId ? resizeFrameAspectLocked(frame, width) : frame),
    }))
  }, [onDocumentChange])

  // A nominee lives on the unit, not the frame: marking an option nominee sets
  // its unit's nomineeFrameId, and marking it again clears it. It never locks.
  const toggleNominee = useCallback((frameId: string) => {
    onDocumentChange((current) => {
      const frame = current.frames.find((item) => item.id === frameId)
      if (!frame?.unitId) return current
      const unitId = frame.unitId
      return {
        ...current,
        units: current.units.map((unit) => unit.id === unitId
          ? { ...unit, nomineeFrameId: unit.nomineeFrameId === frameId ? undefined : frameId }
          : unit),
      }
    })
  }, [onDocumentChange])

  const toggleZoneCollapsed = useCallback((zoneId: string) => {
    onDocumentChange((current) => ({
      ...current,
      zones: current.zones.map((zone) => zone.id === zoneId
        ? { ...zone, collapsed: !zone.collapsed }
        : zone),
    }))
  }, [onDocumentChange])

  const buildNodes = useCallback((): ReviewFlowNode[] => {
    const collapsedZoneIds = new Set(
      document.zones.filter((zone) => zone.collapsed).map((zone) => zone.id),
    )
    const zoneNodes: ReviewFlowNode[] = document.zones.map((zone) => {
      const height = zone.collapsed ? Math.min(zone.height, COLLAPSED_ZONE_HEIGHT) : zone.height
      return {
        id: `zone:${zone.id}`,
        type: 'boardZone' as const,
        position: { x: zone.x, y: zone.y },
        width: zone.width,
        height,
        style: { width: zone.width, height, zIndex: 0 },
        draggable: false,
        selectable: false,
        data: {
          zone,
          memberFrames: document.frames.filter((frame) => frame.zoneId === zone.id),
          onToggleCollapsed: toggleZoneCollapsed,
        },
      }
    })

    const screenNodes: ReviewFlowNode[] = document.frames
      .filter((frame) => !(frame.zoneId && collapsedZoneIds.has(frame.zoneId)))
      .map((frame) => ({
        id: frame.id,
        type: 'screen' as const,
        position: { x: frame.x, y: frame.y },
        width: frame.width,
        height: frame.height,
        style: { width: frame.width, height: frame.height, zIndex: 1 },
        draggable: tool === 'select' && focusedFrameId !== frame.id,
        // A playable option only drags by its handle, so canvas pan/zoom and iframe
        // input never fight over the frame body.
        dragHandle: frame.kind === 'playable-option' ? '.frame-drag-handle' : undefined,
        selected: selectedFrameId === frame.id,
        data: {
          frame,
          annotations: document.annotations.filter((annotation) => annotation.frameId === frame.id),
          tool,
          focused: focusedFrameId === frame.id,
          liveFrameConfig: focusedFrameId === frame.id ? liveFrameConfig : null,
          playableMode: playableFrameModes[frame.id] ?? 'review',
          isPlayableLiveEligible: liveEligibleIds.has(frame.id),
          selectedAnnotationId,
          onCircle: addCircle,
          onPath: addPath,
          onComment: addComment,
          onElementPick: pickElement,
          onFocus: onFocusFrame,
          onResize: resizeFrame,
          onSelectAnnotation,
          isNominee: frame.unitId
            ? document.units.find((unit) => unit.id === frame.unitId)?.nomineeFrameId === frame.id
            : false,
          onToggleNominee: toggleNominee,
        },
      }))

    // Zones paint behind frames: list them first and keep zIndex lower.
    return [...zoneNodes, ...screenNodes]
  }, [
    addCircle,
    addComment,
    addPath,
    document,
    focusedFrameId,
    liveEligibleIds,
    liveFrameConfig,
    onFocusFrame,
    onSelectAnnotation,
    pickElement,
    playableFrameModes,
    resizeFrame,
    selectedAnnotationId,
    selectedFrameId,
    toggleNominee,
    toggleZoneCollapsed,
    tool,
  ])

  const [nodes, setNodes] = useNodesState<ReviewFlowNode>(buildNodes())

  useEffect(() => {
    setNodes(buildNodes())
  }, [buildNodes, setNodes])

  const handleNodesChange = useCallback((changes: NodeChange<ReviewFlowNode>[]) => {
    // Frames are only removed through the board document, never by React Flow itself.
    setNodes((current) => applyNodeChanges(changes.filter((change) => change.type !== 'remove'), current))
  }, [setNodes])

  const handleNodeDragStart = useCallback((_: MouseEvent | TouchEvent, node: ReviewFlowNode) => {
    if (node.type !== 'screen') return
    const frame = document.frames.find((item) => item.id === node.id)
    if (!frame) return
    dragOriginRef.current = { frameId: frame.id, x: frame.x, y: frame.y }
  }, [document.frames])

  const handleNodeDragStop = useCallback((_: MouseEvent | TouchEvent, node: ReviewFlowNode) => {
    if (node.type !== 'screen') return
    const position = { x: node.position.x, y: node.position.y }
    const intent = classifyFrameDragStop(document, node.id, position)
    const origin = dragOriginRef.current
    dragOriginRef.current = null

    if (intent.kind === 'kill-confirm') {
      const frame = document.frames.find((item) => item.id === node.id)
      if (frame?.unitId) {
        onRequestKillConfirm?.({
          frameId: frame.id,
          unitId: frame.unitId,
          dropPosition: intent.dropPosition,
        })
      }
      // Revert the visual drag; confirm is the only path that mutates lifeState.
      setNodes(buildNodes())
      return
    }

    if (intent.kind === 'snap-back') {
      setNodes(buildNodes())
      return
    }

    if (intent.kind === 'archive') {
      const result = moveFrameToArchiveZone(document, node.id, position)
      if (result.ok) onDocumentChange(result.document)
      else setNodes(buildNodes())
      return
    }

    if (intent.kind === 'restore-active') {
      const result = restoreFrameFromZone(document, node.id, position)
      if (result.ok) onDocumentChange(result.document)
      else setNodes(buildNodes())
      return
    }

    const result = repositionFrame(document, node.id, position)
    if (result.ok) onDocumentChange(result.document)
    else if (origin) {
      onDocumentChange((current) => ({
        ...current,
        frames: current.frames.map((frame) => frame.id === origin.frameId
          ? { ...frame, x: origin.x, y: origin.y }
          : frame),
      }))
    }
  }, [buildNodes, document, onDocumentChange, onRequestKillConfirm, setNodes])

  const handleMoveEnd: OnMove = useCallback((_, viewport) => {
    onDocumentChange((current) => ({
      ...current,
      camera: {
        worldX: -viewport.x / viewport.zoom,
        worldY: -viewport.y / viewport.zoom,
        zoom: viewport.zoom,
      },
    }))
  }, [onDocumentChange])

  // Track the live viewport during the gesture (not only at its end) so the live
  // mount set follows the pan, coalesced to one update per frame.
  const handleMove: OnMove = useCallback((_, viewport) => {
    pendingViewportRef.current = viewport
    if (viewportFrameRef.current !== null) return
    viewportFrameRef.current = requestAnimationFrame(() => {
      viewportFrameRef.current = null
      if (pendingViewportRef.current) setLiveViewport(pendingViewportRef.current)
    })
  }, [])

  const initialViewport = useMemo(() => documentViewport(document), [document.boardId])

  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    if ((event.target as Element).closest('[data-annotation-id]')) return
    onSelectFrame(null)
    onSelectAnnotation(null)
  }, [onSelectAnnotation, onSelectFrame])

  const handleCanvasKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
  // Blooms and their form controls live inside the React Flow node. Do not
  // steal Enter/Space/arrows from them — close/select must still work.
  if (target.closest('.annotation-bloom-anchor')) {
    if (event.key === 'Escape') {
      onSelectFrame(null)
      onSelectAnnotation(null)
    }
    return
  }
  if (target.matches('textarea, input, select')) return

    const frameId = target.closest('[data-id]')?.getAttribute('data-id') ?? null
    const isKnownFrame = frameId !== null && document.frames.some((frame) => frame.id === frameId)

    if (event.key === 'Escape') {
      onSelectFrame(null)
      onSelectAnnotation(null)
      return
    }

    if ((event.key === 'Enter' || event.key === ' ') && isKnownFrame && frameId) {
      event.preventDefault()
      if (tool === 'select') {
        onSelectFrame(frameId)
        onSelectAnnotation(null)
        return
      }
      // A live frame replaces its capture, so a new annotation would be stale immediately.
      if (frameId === focusedFrameId) return
      if (tool === 'circle') {
        addCircle(frameId, [0.35, 0.35], [0.65, 0.65])
        return
      }
      addComment(frameId, [0.5, 0.5])
      return
    }

    const delta = ARROW_KEY_DELTAS[event.key]
    if (delta && tool === 'select' && isKnownFrame && frameId) {
      event.preventDefault()
      if (frameId !== selectedFrameId) onSelectFrame(frameId)
      const step = event.shiftKey ? 32 : 8
      onDocumentChange((current) => ({
        ...current,
        frames: current.frames.map((frame) => frame.id === frameId
          ? { ...frame, x: frame.x + delta[0] * step, y: frame.y + delta[1] * step }
          : frame),
      }))
    }
  }, [addCircle, addComment, document.frames, focusedFrameId, onDocumentChange, onSelectAnnotation, onSelectFrame, selectedFrameId, tool])

  const handleNodeClick = useCallback((event: React.MouseEvent, node: ReviewFlowNode) => {
    if (node.type !== 'screen' || tool !== 'select') return
    const surface = (event.target as Element).closest(`[data-testid="surface-${node.id}"]`)
    if (surface) {
      const picked = pickAnnotationAtClientPoint(
        node.data.annotations,
        event.clientX,
        event.clientY,
        surface.getBoundingClientRect(),
        selectedAnnotationId,
      )
      if (picked) {
        onSelectAnnotation(picked)
        return
      }
    }
    onSelectFrame(node.id)
    onSelectAnnotation(null)
  }, [onSelectAnnotation, onSelectFrame, selectedAnnotationId, tool])

  return (
    <main className="canvas-shell" data-testid="reactflow-canvas" ref={canvasShellRef} onKeyDown={handleCanvasKeyDown}>
      <ReactFlow<ReviewFlowNode>
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onInit={onReady}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
        defaultViewport={initialViewport}
        minZoom={0.25}
        maxZoom={2}
        panOnDrag={[0, 1, 2]}
        panOnScroll
        zoomOnScroll
        nodesDraggable={tool === 'select'}
        elementsSelectable={tool === 'select'}
        deleteKeyCode={null}
        disableKeyboardA11y
        onlyRenderVisibleElements
      >
        <Background gap={24} size={1} color="#d5dae3" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </main>
  )
}
