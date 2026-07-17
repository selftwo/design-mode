import { useCallback, useEffect, useMemo } from 'react'
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
import { pickAnnotationAtClientPoint } from '../../model/pick-annotation-at-point'
import type { CanvasEngineProps } from '../canvas-engine'
import { ScreenFrameNode, type ScreenFrameNodeData } from './ScreenFrameNode'

const nodeTypes = { screen: ScreenFrameNode }

const ARROW_KEY_DELTAS: Record<string, readonly [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
}

const MINIMUM_CIRCLE_EXTENT = 0.02

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
  onDocumentChange,
  onFocusFrame,
  onSelectFrame,
  onSelectAnnotation,
  onAnnotationCreated,
  onReady,
}: CanvasEngineProps) {
  const addCircle = useCallback((frameId: string, start: NormalizedPoint, end: NormalizedPoint) => {
    const frame = document.frames.find((item) => item.id === frameId)
    if (!frame) return
    // A click without a drag would create an invisible zero-size ellipse.
    const [markStart, markEnd] = inflateToMinimumExtent(start, end)
    onAnnotationCreated({
      id: crypto.randomUUID(),
      frameId,
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

  const buildNodes = useCallback((): Node<ScreenFrameNodeData>[] => {
    return document.frames.map((frame) => ({
      id: frame.id,
      type: 'screen',
      position: { x: frame.x, y: frame.y },
      width: frame.width,
      height: frame.height,
      style: { width: frame.width, height: frame.height },
      draggable: tool === 'select' && focusedFrameId !== frame.id,
      selected: selectedFrameId === frame.id,
      data: {
        frame,
        annotations: document.annotations.filter((annotation) => annotation.frameId === frame.id),
        tool,
        focused: focusedFrameId === frame.id,
        liveFrameConfig: focusedFrameId === frame.id ? liveFrameConfig : null,
        selectedAnnotationId,
        onCircle: addCircle,
        onPath: addPath,
        onComment: addComment,
        onElementPick: pickElement,
        onFocus: onFocusFrame,
        onResize: resizeFrame,
        onSelectAnnotation,
      },
    }))
  }, [addCircle, addComment, addPath, document, focusedFrameId, liveFrameConfig, onFocusFrame, onSelectAnnotation, pickElement, resizeFrame, selectedAnnotationId, selectedFrameId, tool])

  const [nodes, setNodes] = useNodesState<Node<ScreenFrameNodeData>>(buildNodes())

  useEffect(() => {
    setNodes(buildNodes())
  }, [buildNodes, setNodes])

  const handleNodesChange = useCallback((changes: NodeChange<Node<ScreenFrameNodeData>>[]) => {
    // Frames are only removed through the board document, never by React Flow itself.
    setNodes((current) => applyNodeChanges(changes.filter((change) => change.type !== 'remove'), current))
  }, [setNodes])

  const handleNodeDragStop = useCallback((_: MouseEvent | TouchEvent, node: Node<ScreenFrameNodeData>) => {
    onDocumentChange((current) => ({
      ...current,
      frames: current.frames.map((frame) => frame.id === node.id ? { ...frame, ...node.position } : frame),
    }))
  }, [onDocumentChange])

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

  const initialViewport = useMemo(() => documentViewport(document), [document.boardId])

  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    if ((event.target as Element).closest('[data-annotation-id]')) return
    onSelectFrame(null)
    onSelectAnnotation(null)
  }, [onSelectAnnotation, onSelectFrame])

  const handleCanvasKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
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

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node<ScreenFrameNodeData>) => {
    if (tool !== 'select') return
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
    <main className="canvas-shell" data-testid="reactflow-canvas" onKeyDown={handleCanvasKeyDown}>
      <ReactFlow<Node<ScreenFrameNodeData>>
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onInit={onReady}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodeDragStop={handleNodeDragStop}
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