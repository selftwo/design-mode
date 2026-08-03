import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import type { AgentAvailability, AgentRun } from '@/features/local-host/host-api.schema'
import { AnnotationInstructionEditor } from './AnnotationInstructionEditor'
import { buildScopeChipLabel } from './build-scope-chip-label'
import { formatRelativeTime } from '@/features/m-web/format-relative-time'
import {
  clampIslandPosition,
  dodgeIslandPosition,
  type Rect,
} from './island-placement'
import { isInstructionIncomplete } from './model/annotation-instruction'
import { isAnnotationStale } from './model/is-annotation-stale'
import type { AnnotationIntent, BoardCamera, ReviewAnnotation, ScreenFrame } from './model/board-document.schema'
import { readSelectionBounds } from './read-selection-bounds'
import './AnnotationBloom.css'

const BLOOM_WIDTH_PX = 304
const MIN_MARK_SIZE_PX = 28

const AGENT_LABELS: Record<AgentRun['agent'], string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
}

function viewportSize(): { width: number; height: number } {
  return { width: window.innerWidth, height: window.innerHeight }
}

function inflateMarkBounds(rect: DOMRect): Rect {
  const width = Math.max(rect.width, MIN_MARK_SIZE_PX)
  const height = Math.max(rect.height, MIN_MARK_SIZE_PX)
  return {
    left: rect.left + (rect.width - width) / 2,
    top: rect.top + (rect.height - height) / 2,
    width,
    height,
  }
}

function bloomTransformOrigin(mark: Rect, placement: { left: number; top: number }): string {
  const anchorX = mark.left + mark.width / 2 - placement.left
  const anchorY = mark.top + mark.height / 2 - placement.top
  return `${anchorX}px ${anchorY}px`
}

export function bloomThreadStateWord(
  annotation: ReviewAnnotation,
  resolved: boolean,
  stale: boolean,
): string {
  if (resolved) return '✓ resolved'
  if (stale) return 'open'
  if (isInstructionIncomplete(annotation.instruction)) return 'draft'
  return 'open'
}

function bloomDotState(
  annotation: ReviewAnnotation,
  resolved: boolean,
  agentRun: AgentRun | null,
): 'waiting' | 'done' {
  if (resolved || agentRun?.status === 'done') return 'done'
  return 'waiting'
}

function placeBloom(mark: Rect, bloomSize: { width: number; height: number }): { left: number; top: number } {
  const viewport = viewportSize()
  const obstacles: Rect[] = [mark]
  document.querySelectorAll<HTMLElement>('.dm-island[data-open="true"]').forEach((element) => {
    const rect = element.getBoundingClientRect()
    obstacles.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
  })
  const placed = dodgeIslandPosition(obstacles, bloomSize, viewport)
  return clampIslandPosition(placed.left, placed.top, bloomSize, viewport)
}

function AgentReplyBlock({ run }: { run: AgentRun }) {
  const initials = AGENT_LABELS[run.agent].slice(0, 2).toUpperCase()
  const reply = run.outputTail.trim() || 'Patch staged.'
  return (
    <div className="dm-thread-c" data-testid="bloom-agent-reply">
      <div className="dm-comment-head">
        <span className="dm-avatar dm-avatar--agent" aria-hidden="true">{initials}</span>
        <span className="dm-comment-author">{AGENT_LABELS[run.agent]}</span>
        <span className="dm-chip-candidate">Candidate</span>
      </div>
      <span className="dm-prov dm-mono" data-testid="bloom-provenance">
        {`⌁ run ${run.id.slice(0, 8)}`}
      </span>
      <p className="dm-comment-body">{reply}</p>
    </div>
  )
}

export function AnnotationBloom({
  annotation,
  frame,
  frameAnnotations,
  selectedFrameId,
  selectedElementId,
  camera,
  autoFocus,
  exportDelivered,
  agentRun,
  resolved,
  onSaveDraft,
  onSetIntent,
  onDelete,
  onResolve,
  dispatchAgents,
  dispatchAgent,
  onDispatch,
  deliveryStatus,
}: {
  annotation: ReviewAnnotation
  frame: ScreenFrame
  frameAnnotations: ReviewAnnotation[]
  selectedFrameId: string | null
  selectedElementId: string | null
  camera: BoardCamera
  autoFocus: boolean
  exportDelivered: boolean
  agentRun: AgentRun | null
  resolved: boolean
  onSaveDraft: (instruction: string) => void
  onSetIntent: (intent: AnnotationIntent | undefined) => void
  onDelete: () => void
  onResolve: () => void
  dispatchAgents?: AgentAvailability[] | null
  dispatchAgent?: AgentRun['agent']
  onDispatch?: (agent: AgentRun['agent']) => void
  deliveryStatus?: 'idle' | 'delivering' | 'delivered' | 'blocked' | 'error'
}) {
  const bloomRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<{ left: number; top: number } | null>(null)
  const [transformOrigin, setTransformOrigin] = useState('50% 0')
  const [bloomAgent, setBloomAgent] = useState<AgentRun['agent']>(dispatchAgent ?? 'claude')
  const stale = isAnnotationStale(annotation, frame)
  const scopeLabel = buildScopeChipLabel(annotation, frameAnnotations, stale)
  const stateWord = bloomThreadStateWord(annotation, resolved, stale)
  const dotState = bloomDotState(annotation, resolved, agentRun)
  const showAgentReply = agentRun?.status === 'done' && !stale

  const applyPlacement = useCallback(() => {
    const rect = readSelectionBounds(selectedFrameId, selectedElementId, annotation.id)
    const element = bloomRef.current
    if (!rect || !element) {
      setPlacement(null)
      return
    }
    const mark = inflateMarkBounds(rect)
    const bloomHeight = element.offsetHeight || 240
    const bloomSize = { width: BLOOM_WIDTH_PX, height: bloomHeight }
    const clamped = placeBloom(mark, bloomSize)
    setPlacement(clamped)
    setTransformOrigin(bloomTransformOrigin(mark, clamped))
  }, [annotation.id, selectedElementId, selectedFrameId])

  useLayoutEffect(() => {
    let cancelled = false
    let outerFrame = 0
    let innerFrame = 0
    let retryFrame = 0
    const read = () => {
      if (cancelled) return
      applyPlacement()
      retryFrame = window.requestAnimationFrame(() => {
        if (!cancelled) applyPlacement()
      })
    }
    outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(read)
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(outerFrame)
      window.cancelAnimationFrame(innerFrame)
      window.cancelAnimationFrame(retryFrame)
    }
  }, [
    applyPlacement,
    annotation.instruction,
    annotation.intent,
    agentRun?.outputTail,
    camera.worldX,
    camera.worldY,
    camera.zoom,
    resolved,
    showAgentReply,
    stale,
  ])

  useEffect(() => {
    const handleViewportChange = () => applyPlacement()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('design-review:viewport-moving', handleViewportChange)
    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
      window.removeEventListener('design-review:viewport-moving', handleViewportChange)
    }
  }, [applyPlacement])

  const style: CSSProperties | undefined = placement
    ? { left: placement.left, top: placement.top, transformOrigin }
    : { left: -9999, top: -9999, pointerEvents: 'none' as const }

  const editorReady = placement !== null

  return (
    <div
      ref={bloomRef}
      className="annotation-bloom dm-bloom"
      style={style}
      data-open="true"
      data-testid={`bloom-${annotation.id}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="dm-thread">
        <div className="dm-thread-head">
          <span className="dm-dot" data-state={dotState} aria-hidden="true" />
          <span className={`dm-thread-state ${stateWord === 'open' ? 'dm-thread-state--open' : ''}`}>
            {stateWord}
          </span>
          <span className={`dm-scope-chip ${stale ? '' : 'dm-scope-chip--live'}`}>{scopeLabel}</span>
        </div>
        <div className="dm-thread-c">
          <AnnotationInstructionEditor
            annotation={annotation}
            frame={frame}
            autoFocus={autoFocus && editorReady}
            compact
            onSaveDraft={onSaveDraft}
            onSetIntent={onSetIntent}
            onDelete={onDelete}
          />
        </div>
        {(annotation.replies ?? []).map((reply) => (
          <div key={reply.id} className="dm-thread-c" data-testid={`bloom-reply-${reply.id}`}>
            <div className="dm-comment-head">
              <span className="dm-avatar dm-avatar--human" aria-hidden="true">
                {reply.author.slice(0, 1).toUpperCase()}
              </span>
              <span className="dm-comment-author">{reply.author}</span>
              <span className="dm-comment-time">{formatRelativeTime(reply.createdAt)}</span>
            </div>
            <p className="dm-comment-body">{reply.body}</p>
          </div>
        ))}
        {showAgentReply ? <AgentReplyBlock run={agentRun} /> : null}
        {!resolved ? (
          <button
            type="button"
            className="dm-btn dm-btn--quiet dm-btn--sm annotation-bloom-resolve"
            data-testid="resolve-annotation"
            onClick={onResolve}
          >
            Resolve
          </button>
        ) : null}
        {stale ? (
          <div className="dm-thread-foot" data-testid="bloom-stale-foot">
            {`made against rev ${annotation.madeAgainstRevision} · anchor is approximate`}
          </div>
        ) : exportDelivered || agentRun?.status === 'done' ? (
          <div className="dm-thread-foot dm-thread-foot--returned" data-testid="bloom-routing-foot">
            <span className="dm-rdot" data-r="returned" aria-hidden="true" />
            returned
          </div>
        ) : (
          <div className="dm-thread-foot bloom-compose-foot" data-testid="bloom-routing-foot">
            <span className="dm-rdot" aria-hidden="true" />
            <span>not routed · dispatch sends 1 annotation</span>
            <select
              className="dm-select"
              aria-label="Dispatch agent"
              value={bloomAgent}
              onChange={(event) => setBloomAgent(event.target.value as AgentRun['agent'])}
              data-testid="bloom-dispatch-agent"
            >
              {(dispatchAgents ?? []).filter((agent) => agent.available).map((agent) => (
                <option key={agent.id} value={agent.id}>{AGENT_LABELS[agent.id]}</option>
              ))}
            </select>
            <button
              type="button"
              className="dm-btn dm-btn--primary dm-btn--sm"
              disabled={!onDispatch || deliveryStatus === 'delivering'}
              data-testid="bloom-dispatch"
              onClick={() => onDispatch?.(bloomAgent)}
            >
              {deliveryStatus === 'delivering' ? 'Sending…' : 'Send'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
