import { memo, useRef, useState } from 'react'
import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import type { LiveReviewFrameConfig } from '@/features/live-review/LiveReviewFrame'
import { LiveFrameHostConnecting } from '@/features/live-review/LiveFrameHostConnecting'
import { LiveReviewFrame } from '@/features/live-review/LiveReviewFrame'
import type {
  FrameElement,
  NormalizedPoint,
  ReviewAnnotation,
  ScreenFrame,
  ToolMode,
} from '../../model/board-document.schema'
import { normalizeLocalPoint, simplifyNormalizedPath } from '../../model/board-geometry'
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
  onPath: (frameId: string, points: NormalizedPoint[]) => void
  onComment: (frameId: string, at: NormalizedPoint) => void
  onElementPick: (frameId: string, element: FrameElement) => void
  onFocus: (frameId: string) => void
  onResize: (frameId: string, width: number) => void
  onSelectAnnotation: (annotationId: string) => void
}

function annotationAriaLabel(
  annotation: ReviewAnnotation,
  annotations: ReviewAnnotation[],
  frame: ScreenFrame,
  stale: boolean,
): string {
  const ordinal = annotations.indexOf(annotation) + 1
  const subject = annotation.mark?.kind === 'element' ? ` on ${annotation.mark.label}` : ''
  return `Review note ${ordinal} of ${annotations.length}${subject} on ${frame.label}${stale ? ', stale capture' : ''}`
}

function markClassName(selected: boolean, stale: boolean): string {
  return ['annotation-mark', selected ? 'selected' : '', stale ? 'stale' : ''].filter(Boolean).join(' ')
}

function polylinePoints(points: readonly NormalizedPoint[]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ')
}

function elementAtNormalizedPoint(elements: FrameElement[], point: NormalizedPoint): FrameElement | null {
  let best: FrameElement | null = null
  let bestArea = Number.POSITIVE_INFINITY
  for (const element of elements) {
    const [start, end] = element.bounds
    if (point[0] < start[0] || point[0] > end[0] || point[1] < start[1] || point[1] > end[1]) continue
    const area = (end[0] - start[0]) * (end[1] - start[1])
    if (area < bestArea) {
      best = element
      bestArea = area
    }
  }
  return best
}

function FrameMarksSvg({
  annotations,
  frame,
  selectable,
  selectedAnnotationId,
  preview,
  onSelectAnnotation,
}: {
  annotations: ReviewAnnotation[]
  frame: ScreenFrame
  selectable: boolean
  selectedAnnotationId: string | null
  preview: readonly NormalizedPoint[] | null
  onSelectAnnotation: (annotationId: string) => void
}) {
  const paintOrder = [...annotations].sort((left, right) => {
    if (left.id === selectedAnnotationId) return 1
    if (right.id === selectedAnnotationId) return -1
    return 0
  })
  const markProps = (annotation: ReviewAnnotation, selected: boolean, stale: boolean, shapeClass = '') => ({
    className: `${shapeClass} ${markClassName(selected, stale)}`.trim(),
    'data-testid': `mark-${annotation.id}`,
    'data-annotation-id': annotation.id,
    'data-stale': String(stale),
    vectorEffect: 'non-scaling-stroke' as const,
    pathLength: 100,
    tabIndex: 0,
    role: 'button' as const,
    'aria-pressed': selected,
    'aria-label': annotationAriaLabel(annotation, annotations, frame, stale),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      event.stopPropagation()
      onSelectAnnotation(annotation.id)
    },
    onPointerDown: (event: React.PointerEvent) => {
      event.preventDefault()
      event.stopPropagation()
      onSelectAnnotation(annotation.id)
    },
  })
  return (
    <svg
      className={`annotation-svg ${selectable ? 'annotation-svg-selectable' : ''}`}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
    >
      {paintOrder.map((annotation) => {
        if (!annotation.mark) return null
        const selected = annotation.id === selectedAnnotationId
        const stale = isAnnotationStale(annotation, frame)
        if (annotation.mark.kind === 'circle') {
          const [start, end] = annotation.mark.points
          return (
            <ellipse
              key={annotation.id}
              cx={(start[0] + end[0]) / 2}
              cy={(start[1] + end[1]) / 2}
              rx={Math.abs(end[0] - start[0]) / 2}
              ry={Math.abs(end[1] - start[1]) / 2}
              {...markProps(annotation, selected, stale)}
            />
          )
        }
        if (annotation.mark.kind === 'element') {
          const [start, end] = annotation.mark.points
          return (
            <rect
              key={annotation.id}
              x={start[0]}
              y={start[1]}
              width={end[0] - start[0]}
              height={end[1] - start[1]}
              {...markProps(annotation, selected, stale, 'element-mark')}
            />
          )
        }
        return (
          <polyline
            key={annotation.id}
            points={polylinePoints(annotation.mark.points)}
            {...markProps(annotation, selected, stale, 'path-mark')}
          />
        )
      })}
      {preview && preview.length > 1 ? (
        <polyline
          className="ink-draw-preview"
          points={polylinePoints(preview)}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  )
}

function CommentPins({
  annotations,
  frame,
  selectedAnnotationId,
  onSelectAnnotation,
}: {
  annotations: ReviewAnnotation[]
  frame: ScreenFrame
  selectedAnnotationId: string | null
  onSelectAnnotation: (annotationId: string) => void
}) {
  return (
    <>
      {annotations.map((annotation) => {
        if (annotation.mark) return null
        const selected = annotation.id === selectedAnnotationId
        const stale = isAnnotationStale(annotation, frame)
        return (
          <button
            key={annotation.id}
            type="button"
            className={`comment-pin ${markClassName(selected, stale)}`}
            style={{ left: `${annotation.anchor[0] * 100}%`, top: `${annotation.anchor[1] * 100}%` }}
            data-testid={`mark-${annotation.id}`}
            data-annotation-id={annotation.id}
            data-stale={String(stale)}
            aria-pressed={selected}
            aria-label={annotationAriaLabel(annotation, annotations, frame, stale)}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onSelectAnnotation(annotation.id)
            }}
            onKeyDown={(event) => {
              // The canvas-level Enter handler selects the whole frame; the pin wins.
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              event.stopPropagation()
              onSelectAnnotation(annotation.id)
            }}
          >
            {annotations.indexOf(annotation) + 1}
          </button>
        )
      })}
    </>
  )
}

export const ScreenFrameNode = memo(function ScreenFrameNode({
  data: node,
  selected,
}: NodeProps<Node<ScreenFrameNodeData>>) {
  const drawPathRef = useRef<NormalizedPoint[] | null>(null)
  const consumeClickRef = useRef(false)
  const [inkPreview, setInkPreview] = useState<readonly NormalizedPoint[] | null>(null)
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null)
  const frame = node.frame

  const surfacePoint = (event: React.PointerEvent<HTMLDivElement>): NormalizedPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    return normalizeLocalPoint([event.clientX - rect.left, event.clientY - rect.top], rect.width, rect.height)
  }

  const cancelDrawing = () => {
    drawPathRef.current = null
    setInkPreview(null)
  }

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
        consumeClickRef.current = true
        node.onSelectAnnotation(picked)
        return
      }
      const element = elementAtNormalizedPoint(frame.elements, surfacePoint(event))
      if (element) {
        event.preventDefault()
        event.stopPropagation()
        consumeClickRef.current = true
        node.onElementPick(frame.id, element)
      }
      return
    }
    drawPathRef.current = [surfacePoint(event)]
    surface.setPointerCapture(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (node.tool === 'select' && !node.focused) {
      const element = elementAtNormalizedPoint(frame.elements, surfacePoint(event))
      setHoveredElementId((current) => (current === (element?.id ?? null) ? current : element?.id ?? null))
      return
    }
    if (!drawPathRef.current || node.tool !== 'circle' || node.focused) return
    drawPathRef.current.push(surfacePoint(event))
    setInkPreview([...drawPathRef.current])
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const path = drawPathRef.current
    cancelDrawing()
    if (!path || node.tool === 'select' || node.focused) return
    if (node.tool === 'circle') {
      const ink = simplifyNormalizedPath([...path, surfacePoint(event)])
      if (ink.length >= 2) {
        node.onPath(frame.id, ink)
      } else {
        // A click without any movement still deserves a visible mark.
        node.onCircle(frame.id, ink[0] ?? path[0]!, ink[0] ?? path[0]!)
      }
    } else {
      node.onComment(frame.id, path[0]!)
    }
    event.preventDefault()
    event.stopPropagation()
  }

  // A pick handled on pointerdown must not bubble a click up to React Flow,
  // where the node click handler would re-select the frame over the annotation.
  const handleClick = (event: React.MouseEvent) => {
    if (!consumeClickRef.current) return
    consumeClickRef.current = false
    event.stopPropagation()
  }

  const hoveredElement = node.tool === 'select' && hoveredElementId
    ? frame.elements.find((element) => element.id === hoveredElementId) ?? null
    : null

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
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={cancelDrawing}
          onPointerLeave={() => setHoveredElementId(null)}
          onClick={handleClick}
          onDoubleClick={() => node.tool === 'select' && node.onFocus(frame.id)}
          data-testid={`surface-${frame.id}`}
        >
          <img
            src={frame.revision > 1 ? frame.refreshedScreenshotDataUrl : frame.screenshotDataUrl}
            alt={frame.label}
            draggable={false}
          />
          <FrameMarksSvg
            annotations={node.annotations}
            frame={frame}
            selectable={node.tool === 'select'}
            selectedAnnotationId={node.selectedAnnotationId}
            preview={inkPreview}
            onSelectAnnotation={node.onSelectAnnotation}
          />
          {hoveredElement ? (
            <div
              className="element-hover"
              data-testid={`element-hover-${hoveredElement.id}`}
              style={{
                left: `${hoveredElement.bounds[0][0] * 100}%`,
                top: `${hoveredElement.bounds[0][1] * 100}%`,
                width: `${(hoveredElement.bounds[1][0] - hoveredElement.bounds[0][0]) * 100}%`,
                height: `${(hoveredElement.bounds[1][1] - hoveredElement.bounds[0][1]) * 100}%`,
              }}
            >
              <span className="element-hover-label">{hoveredElement.label}</span>
            </div>
          ) : null}
          <CommentPins
            annotations={node.annotations}
            frame={frame}
            selectedAnnotationId={node.selectedAnnotationId}
            onSelectAnnotation={node.onSelectAnnotation}
          />
        </div>
      )}
      {/* Outside .screen-content so the label can sit above the clipped surface. */}
      <span className="screen-label">{frame.label}</span>
    </div>
  )
})
