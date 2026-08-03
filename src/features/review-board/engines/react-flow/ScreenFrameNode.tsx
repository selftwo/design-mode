import { memo, useRef, useState } from 'react'
import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import type { LiveReviewFrameConfig } from '@/features/live-review/LiveReviewFrame'
import { LiveFrameHostConnecting } from '@/features/live-review/LiveFrameHostConnecting'
import { LiveReviewFrame } from '@/features/live-review/LiveReviewFrame'
import { PlayableOptionFrame, type PlayableInteractionMode } from '@/features/playable-option/PlayableOptionFrame'
import type {
  FrameElement,
  NormalizedPoint,
  ReviewAnnotation,
  ScreenFrame,
  TeachAnnotation,
  ToolMode,
} from '../../model/board-document.schema'
import type { LayersTreeTarget } from '../../build-layers-tree'
import { clampUnit, normalizeLocalPoint, simplifyNormalizedPath } from '../../model/board-geometry'
import { pickAnnotationAtClientPoint } from '../../model/pick-annotation-at-point'
import { isAnnotationStale } from '../../model/is-annotation-stale'
import { AgentQuestionBloom } from '../../AgentQuestionBloom'
import { isReviewAnnotation, isTeachAnnotation } from '../../is-board-annotation'
import { TeachAnnotationNotes } from '../../TeachAnnotationNote'
import '../../FrameAnnotationMarks.css'
import '../../AgentQuestionBloom.css'
import './ScreenFrameSurface.css'

export interface ScreenFrameNodeData extends Record<string, unknown> {
  frame: ScreenFrame
  annotations: Array<ReviewAnnotation | TeachAnnotation>
  tool: ToolMode
  learnLensOpen: boolean
  focused: boolean
  liveFrameConfig: LiveReviewFrameConfig | null
  // Playable-option live mount: whether this frame is in the capped active set,
  // and its in-memory play/review mode.
  isPlayableLiveEligible: boolean
  playableMode: PlayableInteractionMode
  selectedAnnotationId: string | null
  selectedElementId: string | null
  outlinedTarget: LayersTreeTarget | null
  resolvedAnnotationIds: ReadonlySet<string>
  onCircle: (frameId: string, start: NormalizedPoint, end: NormalizedPoint) => void
  onPath: (frameId: string, points: NormalizedPoint[]) => void
  onComment: (frameId: string, at: NormalizedPoint) => void
  onElementPick: (frameId: string, element: FrameElement) => void
  onLearnElementPick: (frameId: string, element: FrameElement) => void
  onFocus: (frameId: string) => void
  onResize: (frameId: string, width: number) => void
  onSelectFrame: (frameId: string) => void
  onSelectElement: (frameId: string, elementId: string | null) => void
  onSelectAnnotation: (annotationId: string | null) => void
  onDeleteTeachAnnotation: (annotationId: string) => void
  onResolveTeachAnnotation: (annotationId: string) => void
  isNominee: boolean
  onToggleNominee: (frameId: string) => void
}

function annotationAriaLabel(
  annotation: ReviewAnnotation | TeachAnnotation,
  annotations: Array<ReviewAnnotation | TeachAnnotation>,
  frame: ScreenFrame,
  stale: boolean,
): string {
  const ordinal = annotations.indexOf(annotation) + 1
  if (isTeachAnnotation(annotation)) {
    return `Teach note ${ordinal} of ${annotations.length} on ${annotation.mark.label} in ${frame.label}${stale ? ', stale capture' : ''}`
  }
  const subject = annotation.mark?.kind === 'element' ? ` on ${annotation.mark.label}` : ''
  const kind = annotation.role === 'agent-question'
    ? 'Agent question'
    : annotation.role === 'teach'
      ? 'Teach note'
      : 'Review note'
  return `${kind} ${ordinal} of ${annotations.length}${subject} on ${frame.label}${stale ? ', stale capture' : ''}`
}

function markClassName(selected: boolean, stale: boolean, role: ReviewAnnotation['role']): string {
  return [
    'annotation-mark',
    selected ? 'selected' : '',
    stale ? 'stale' : '',
    role !== 'review' ? `role-${role}` : '',
  ].filter(Boolean).join(' ')
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
    className: `${shapeClass} ${markClassName(selected, stale, annotation.role)}`.trim(),
    'data-testid': `mark-${annotation.id}`,
    'data-annotation-id': annotation.id,
    'data-stale': String(stale),
    'data-role': annotation.role,
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
            className={`comment-pin dm-mark dm-mark-pin ${markClassName(selected, stale, annotation.role)}`}
            style={{ left: `${annotation.anchor[0] * 100}%`, top: `${annotation.anchor[1] * 100}%` }}
            data-testid={`mark-${annotation.id}`}
            data-annotation-id={annotation.id}
            data-stale={String(stale)}
            data-role={annotation.role}
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

function elementOutlineStyle(element: FrameElement): React.CSSProperties {
  const [start, end] = element.bounds
  return {
    left: `${start[0] * 100}%`,
    top: `${start[1] * 100}%`,
    width: `${(end[0] - start[0]) * 100}%`,
    height: `${(end[1] - start[1]) * 100}%`,
  }
}

function ElementOutline({
  element,
  frameId,
  className,
  testId,
}: {
  element: FrameElement
  frameId: string
  className: string
  testId: string
}) {
  return (
    <div
      className={className}
      data-testid={testId}
      data-element-id={element.id}
      data-frame-id={frameId}
      style={elementOutlineStyle(element)}
    />
  )
}

const DRAG_THRESHOLD_PX = 3

export const ScreenFrameNode = memo(function ScreenFrameNode({
  data: node,
  selected,
}: NodeProps<Node<ScreenFrameNodeData>>) {
  const drawPathRef = useRef<NormalizedPoint[] | null>(null)
  const consumeClickRef = useRef(false)
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)
  const [inkPreview, setInkPreview] = useState<readonly NormalizedPoint[] | null>(null)
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null)
  const frame = node.frame

  const isPlayable = frame.kind === 'playable-option'
  // A live iframe is mounted for this frame (in the capped active set and it has
  // a source). Element bounds describe the still screenshot, so picking/hovering
  // elements is skipped over a mounted playable.
  const playableLive = isPlayable && node.isPlayableLiveEligible && frame.liveSource !== undefined
  const playMode = node.playableMode === 'play'
  const capturedLive = node.focused && node.liveFrameConfig !== null
  // In these modes the live layer owns pointer input; the mark overlay is kept
  // mounted and visible but inert. This is also the fix for the old branch that
  // dropped marks under a focused live frame.
  const liveInteractive = capturedLive || (playableLive && playMode)

  const surfacePoint = (event: React.PointerEvent<HTMLDivElement>): NormalizedPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    return normalizeLocalPoint([event.clientX - rect.left, event.clientY - rect.top], rect.width, rect.height)
  }

  const cancelDrawing = () => {
    drawPathRef.current = null
    setInkPreview(null)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    consumeClickRef.current = false
    if (node.focused) return
    if (node.tool === 'select') {
      pointerDownRef.current = { x: event.clientX, y: event.clientY }
    }
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
      if (playableLive) return
      const element = elementAtNormalizedPoint(frame.elements, surfacePoint(event))
      if (element) {
        event.preventDefault()
        event.stopPropagation()
        consumeClickRef.current = true
        if (node.learnLensOpen) {
          node.onLearnElementPick(frame.id, element)
          node.onSelectElement(frame.id, element.id)
        } else {
          node.onElementPick(frame.id, element)
        }
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
      if (playableLive) return
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
    const clearBackgroundPointer = pointerDownRef.current
    pointerDownRef.current = null
    if (
      node.tool === 'select'
      && !node.focused
      && clearBackgroundPointer
      && !consumeClickRef.current
      && Math.hypot(event.clientX - clearBackgroundPointer.x, event.clientY - clearBackgroundPointer.y) < DRAG_THRESHOLD_PX
    ) {
      const rect = event.currentTarget.getBoundingClientRect()
      const picked = pickAnnotationAtClientPoint(
        node.annotations,
        event.clientX,
        event.clientY,
        rect,
        node.selectedAnnotationId,
      )
      if (!picked) {
        const point: NormalizedPoint = [
          clampUnit((event.clientX - rect.left) / rect.width),
          clampUnit((event.clientY - rect.top) / rect.height),
        ]
        if (!elementAtNormalizedPoint(frame.elements, point)) {
          node.onSelectFrame(frame.id)
          node.onSelectElement(frame.id, null)
          node.onSelectAnnotation(null)
        }
      }
    }
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
  const selectedElement = node.selectedElementId
    ? frame.elements.find((element) => element.id === node.selectedElementId) ?? null
    : null
  const outlined = node.outlinedTarget
  const treeOutlinedElement = outlined?.kind === 'element' && outlined.frameId === frame.id
    ? frame.elements.find((element) => element.id === outlined.elementId) ?? null
    : null
  const treeOutlinedFrame = outlined?.kind === 'frame' && outlined.frameId === frame.id
  const reviewAnnotations = node.annotations.filter(isReviewAnnotation)
  const teachAnnotations = node.annotations.filter(isTeachAnnotation)

  const isOption = frame.kind === 'option-snapshot' || frame.kind === 'playable-option'
  const isZoned = frame.lifeState === 'archived' || frame.lifeState === 'killed'

  // One media stack for every frame: the screenshot shell, an optional live layer
  // (captured-route session or playable-option iframe) over it, and the mark and
  // pin overlay always mounted above. In a live-interactive mode the overlay is
  // present but inert so the live layer takes pointer input.
  return (
    <div
      className={`screen-node ${isOption ? 'lofi-option' : ''} ${node.isNominee ? 'is-preferred' : ''} ${isZoned ? 'is-zoned' : ''} ${treeOutlinedFrame ? 'screen-node-tree-outline' : ''}`.trim()}
      style={{ width: frame.width, height: frame.height }}
      data-testid={`frame-${frame.id}`}
      data-frame-id={frame.id}
      data-draggable={node.tool === 'select' && !node.focused && !isPlayable}
    >
      <NodeResizer
        isVisible={selected && node.tool === 'select' && !node.focused}
        keepAspectRatio
        minWidth={120}
        handleClassName="frame-resize-handle"
        lineClassName="frame-resize-line"
        onResizeEnd={(_, parameters) => node.onResize(frame.id, parameters.width)}
      />
      {isPlayable ? (
        // A playable option only drags by this handle, so its live iframe body
        // never fights canvas pan or the reviewer's input.
        <div className="frame-drag-handle" data-testid={`drag-handle-${frame.id}`} title="Drag to move" />
      ) : null}
      <div
        className={`screen-content ${node.tool !== 'select' && !liveInteractive ? 'draw-active nodrag nopan' : ''} ${liveInteractive ? 'live-interactive' : ''}`.trim()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={cancelDrawing}
        onPointerLeave={() => setHoveredElementId(null)}
        onClick={handleClick}
        onDoubleClick={() => node.tool === 'select' && frame.kind === 'captured-route' && node.onFocus(frame.id)}
        data-testid={`surface-${frame.id}`}
      >
        <img
          src={frame.revision > 1 ? frame.refreshedScreenshotDataUrl : frame.screenshotDataUrl}
          alt={frame.label}
          draggable={false}
        />
        {capturedLive && node.liveFrameConfig ? (
          <LiveReviewFrame config={node.liveFrameConfig} />
        ) : node.focused ? (
          <LiveFrameHostConnecting frameId={frame.id} />
        ) : null}
        {playableLive && frame.liveSource ? (
          <PlayableOptionFrame
            frameId={frame.id}
            sourcePath={frame.liveSource.path}
            interactionMode={playMode ? 'play' : 'review'}
          />
        ) : null}
        {isOption ? (
          <div className="lofi-option-chip">
            <span className="lofi-option-badge">Option</span>
            <button
              type="button"
              className="lofi-prefer-toggle"
              aria-pressed={node.isNominee}
              data-testid={`prefer-${frame.id}`}
              title={node.isNominee ? 'Nominee' : 'Mark as nominee'}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                node.onToggleNominee(frame.id)
              }}
            >
              {node.isNominee ? '★ Nominee' : '☆ Nominate'}
            </button>
          </div>
        ) : null}
        <FrameMarksSvg
          annotations={reviewAnnotations}
          frame={frame}
          selectable={node.tool === 'select' && !liveInteractive}
          selectedAnnotationId={node.selectedAnnotationId}
          preview={inkPreview}
          onSelectAnnotation={node.onSelectAnnotation}
        />
        <TeachAnnotationNotes
          annotations={teachAnnotations}
          frame={frame}
          selectedAnnotationId={node.selectedAnnotationId}
          onSelectAnnotation={node.onSelectAnnotation}
          onDelete={node.onDeleteTeachAnnotation}
        />
        {hoveredElement && !playableLive ? (
          <div
            className="element-hover"
            data-testid={`element-hover-${hoveredElement.id}`}
            data-element-id={hoveredElement.id}
            data-frame-id={frame.id}
            style={elementOutlineStyle(hoveredElement)}
          >
            <span className="element-hover-label">{hoveredElement.label}</span>
          </div>
        ) : null}
        {selectedElement && selectedElement.id !== hoveredElement?.id ? (
          <ElementOutline
            element={selectedElement}
            frameId={frame.id}
            className="element-selected"
            testId={`element-selected-${selectedElement.id}`}
          />
        ) : null}
        {treeOutlinedElement
          && treeOutlinedElement.id !== hoveredElement?.id
          && treeOutlinedElement.id !== selectedElement?.id ? (
            <ElementOutline
              element={treeOutlinedElement}
              frameId={frame.id}
              className="element-tree-outline"
              testId={`element-tree-outline-${treeOutlinedElement.id}`}
            />
          ) : null}
        <CommentPins
          annotations={reviewAnnotations}
          frame={frame}
          selectedAnnotationId={node.selectedAnnotationId}
          onSelectAnnotation={node.onSelectAnnotation}
        />
      </div>
      {/* Agent questions bloom at their mark anchors. Review editors are hosted
          outside React Flow (App) so keyboard focus is not eaten by the canvas. */}
      {(() => {
        const selected = reviewAnnotations.find((item) => item.id === node.selectedAnnotationId)
        if (!selected || selected.role !== 'agent-question') return null
        return (
          <div
            className="annotation-bloom-anchor nodrag nopan nowheel at-anchor"
            style={{ left: `${selected.anchor[0] * 100}%`, top: `${selected.anchor[1] * 100}%` }}
            onPointerDown={(event) => event.stopPropagation()}
            data-testid={`annotation-bloom-${selected.id}`}
          >
            <AgentQuestionBloom
              kind="agent-question"
              instruction={selected.instruction}
              runId={selected.runId}
              onClose={() => node.onSelectAnnotation(null)}
            />
          </div>
        )
      })()}
      {/* Outside .screen-content so the label can sit above the clipped surface. */}
      <span className="screen-label dm-frame-label dm-mono">{frame.label}</span>
    </div>
  )
})
