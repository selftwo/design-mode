import { memo, useRef } from 'react'
import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import type { LiveReviewFrameConfig } from '@/features/live-review/LiveReviewFrame'
import { LiveFrameHostConnecting } from '@/features/live-review/LiveFrameHostConnecting'
import { LiveReviewFrame } from '@/features/live-review/LiveReviewFrame'
import type { NormalizedPoint, ReviewAnnotation, ScreenFrame, ToolMode } from '../../model/board-document.schema'
import { normalizeLocalPoint } from '../../model/board-geometry'
import { pickAnnotationAtClientPoint } from '../../model/pick-annotation-at-point'
import { isAnnotationStale } from '../../model/is-annotation-stale'
import '../../FrameAnnotationMarks.css'
import './ScreenFrameSurface.css'

export interface ScreenFrameNodeData extends Record<string, unknown> {
  frame: ScreenFrame
  annotations: ReviewAnnotation[]
  tool: ToolMode
  focused: boolean
  liveFrameConfig: LiveReviewFrameConfig | null
  selectedAnnotationId: string | null
  onCircle: (frameId: string, start: NormalizedPoint, end: NormalizedPoint) => void
  onComment: (frameId: string, at: NormalizedPoint) => void
  onFocus: (frameId: string) => void
  onResize: (frameId: string, width: number) => void
  onSelectAnnotation: (annotationId: string) => void
}

function AnnotationSvg({
  annotations,
  frame,
  tool,
  selectedAnnotationId,
}: {
  annotations: ReviewAnnotation[]
  frame: ScreenFrame
  tool: ToolMode
  selectedAnnotationId: string | null
}) {
  const selectable = tool === 'select'
  const paintOrder = [...annotations].sort((left, right) => {
    if (left.id === selectedAnnotationId) return 1
    if (right.id === selectedAnnotationId) return -1
    return 0
  })
  return (
    <svg
      className={`annotation-svg ${selectable ? 'annotation-svg-selectable' : ''}`}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden={!selectable}
    >
      {paintOrder.map((annotation) => {
        const selected = annotation.id === selectedAnnotationId
        const stale = isAnnotationStale(annotation, frame)
        const className = [
          'annotation-mark',
          selected ? 'selected' : '',
          stale ? 'stale' : '',
        ].filter(Boolean).join(' ')
        if (annotation.mark) {
          const [start, end] = annotation.mark.points
          return (
            <ellipse
              key={annotation.id}
              className={className}
              data-testid={`mark-${annotation.id}`}
              data-annotation-id={annotation.id}
              data-stale={String(stale)}
              cx={(start[0] + end[0]) / 2}
              cy={(start[1] + end[1]) / 2}
              rx={Math.abs(end[0] - start[0]) / 2}
              ry={Math.abs(end[1] - start[1]) / 2}
              vectorEffect="non-scaling-stroke"
            />
          )
        }
        return (
          <g
            key={annotation.id}
            className={className}
            data-testid={`mark-${annotation.id}`}
            data-annotation-id={annotation.id}
            data-stale={String(stale)}
          >
            <circle
              cx={annotation.anchor[0]}
              cy={annotation.anchor[1]}
              r="0.04"
              className="comment-hit"
              fill="transparent"
              stroke="transparent"
            />
            <circle cx={annotation.anchor[0]} cy={annotation.anchor[1]} r="0.018" className="comment-dot" />
          </g>
        )
      })}
    </svg>
  )
}

export const ScreenFrameNode = memo(function ScreenFrameNode({
  data: node,
  selected,
}: NodeProps<Node<ScreenFrameNodeData>>) {
  const startRef = useRef<readonly [number, number] | null>(null)
  const frame = node.frame

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (node.focused) return
    const surface = event.currentTarget
    if (node.tool === 'select') {
      const picked = pickAnnotationAtClientPoint(
        node.annotations,
        event.clientX,
        event.clientY,
        surface.getBoundingClientRect(),
        node.selectedAnnotationId,
      )
      if (picked) {
        event.preventDefault()
        event.stopPropagation()
        node.onSelectAnnotation(picked)
      }
      return
    }
    const rect = surface.getBoundingClientRect()
    startRef.current = [event.clientX - rect.left, event.clientY - rect.top]
    surface.setPointerCapture(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current
    startRef.current = null
    if (!start || node.tool === 'select' || node.focused) return
    const rect = event.currentTarget.getBoundingClientRect()
    const end = [event.clientX - rect.left, event.clientY - rect.top] as const
    const normalizedStart = normalizeLocalPoint(start, rect.width, rect.height)
    if (node.tool === 'circle') {
      node.onCircle(frame.id, normalizedStart, normalizeLocalPoint(end, rect.width, rect.height))
    } else {
      node.onComment(frame.id, normalizedStart)
    }
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div
      className="screen-node"
      style={{ width: frame.width, height: frame.height }}
      data-testid={`frame-${frame.id}`}
      data-frame-id={frame.id}
    >
      <NodeResizer
        isVisible={selected && node.tool === 'select' && !node.focused}
        keepAspectRatio
        minWidth={120}
        onResizeEnd={(_, parameters) => node.onResize(frame.id, parameters.width)}
      />
      {node.focused && node.liveFrameConfig ? (
        <LiveReviewFrame config={node.liveFrameConfig} />
      ) : node.focused ? (
        <LiveFrameHostConnecting frameId={frame.id} />
      ) : (
        <div
          className={`screen-content ${node.tool !== 'select' ? 'draw-active nodrag nopan' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onDoubleClick={() => node.tool === 'select' && node.onFocus(frame.id)}
          data-testid={`surface-${frame.id}`}
        >
          <img
            src={frame.revision > 1 ? frame.refreshedScreenshotDataUrl : frame.screenshotDataUrl}
            alt={frame.label}
            draggable={false}
          />
          <AnnotationSvg
            annotations={node.annotations}
            frame={frame}
            tool={node.tool}
            selectedAnnotationId={node.selectedAnnotationId}
          />
          <span className="screen-label">{frame.label}</span>
        </div>
      )}
    </div>
  )
})