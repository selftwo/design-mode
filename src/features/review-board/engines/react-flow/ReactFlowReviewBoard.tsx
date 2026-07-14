import { useCallback, useEffect, useMemo } from 'react'
import {
  Background,
  ReactFlow,
  applyNodeChanges,
  useNodesState,
  type Node,
  type NodeChange,
  type OnMove,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { NormalizedPoint } from '../../model/board-document.schema'
import { resizeFrameAspectLocked } from '../../model/board-geometry'
import { pickAnnotationAtClientPoint } from '../../model/pick-annotation-at-point'
import type { CanvasEngineProps } from '../canvas-engine'
import { ScreenFrameNode, type ScreenFrameNodeData } from './ScreenFrameNode'

const nodeTypes = { screen: ScreenFrameNode }

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
  focusToken,
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
    onAnnotationCreated({
      id: crypto.randomUUID(),
      frameId,
      status: 'draft',
      instruction: '',
      anchor: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
      mark: { kind: 'circle', points: [start, end] },
      createdAt: new Date().toISOString(),
      madeAgainstCaptureHash: frame.captureHash,
      madeAgainstRevision: frame.revision,
    })
  }, [document.frames, onAnnotationCreated])

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
        focusToken,
        selectedAnnotationId,
        onCircle: addCircle,
        onComment: addComment,
        onFocus: onFocusFrame,
        onResize: resizeFrame,
        onSelectAnnotation,
      },
    }))
  }, [addCircle, addComment, document, focusToken, focusedFrameId, onFocusFrame, onSelectAnnotation, resizeFrame, selectedAnnotationId, selectedFrameId, tool])

  const [nodes, setNodes] = useNodesState<Node<ScreenFrameNodeData>>(buildNodes())

  useEffect(() => {
    setNodes(buildNodes())
  }, [buildNodes, setNodes])

  const handleNodesChange = useCallback((changes: NodeChange<Node<ScreenFrameNodeData>>[]) => {
    setNodes((current) => applyNodeChanges(changes, current))
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
    <main className="canvas-shell" data-testid="reactflow-canvas">
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
        panOnDrag={tool === 'select' ? [1, 2] : false}
        zoomOnScroll={tool === 'select'}
        nodesDraggable={tool === 'select'}
        elementsSelectable={tool === 'select'}
        onlyRenderVisibleElements
      >
        <Background gap={24} size={1} />
      </ReactFlow>
    </main>
  )
}