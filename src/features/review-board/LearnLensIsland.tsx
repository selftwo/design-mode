import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import type { FrameElement, ScreenFrame } from './model/board-document.schema'
import type { LearnContent } from './derive-learn-content'
import { clampIslandPosition } from './island-placement'
import { useIslandHeaderDrag } from './useIslandHeaderDrag'
import './LearnLensIsland.css'

const NUDGE_STEP_PX = 8
const NUDGE_COARSE_STEP_PX = 32
const DEFAULT_TOP_PX = 96
const DEFAULT_LEFT_PX = 16

function viewportSize(): { width: number; height: number } {
  return { width: window.innerWidth, height: window.innerHeight }
}

function islandSize(element: HTMLElement): { width: number; height: number } {
  const rect = element.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
}

export function LearnLensIsland({
  open,
  frame,
  element,
  content,
  questionDraft,
  askedQuestion,
  answer,
  asking,
  askError,
  canAsk,
  pinned,
  onQuestionDraftChange,
  onAsk,
  onPin,
  onClose,
}: {
  open: boolean
  frame: ScreenFrame | null
  element: FrameElement | null
  content: LearnContent | null
  questionDraft: string
  askedQuestion: string | null
  answer: string | null
  asking: boolean
  askError: string | null
  canAsk: boolean
  pinned: boolean
  onQuestionDraftChange: (value: string) => void
  onAsk: () => void
  onPin: () => void
  onClose: () => void
}) {
  const islandRef = useRef<HTMLElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const placedRef = useRef(false)

  useEffect(() => {
    if (!open) {
      placedRef.current = false
      setPosition(null)
    }
  }, [open])

  const placeAt = useCallback((left: number, top: number) => {
    const island = islandRef.current
    if (!island) return
    const clamped = clampIslandPosition(left, top, islandSize(island), viewportSize())
    setPosition(clamped)
    placedRef.current = true
  }, [])

  useEffect(() => {
    if (!open || placedRef.current || position !== null) return
    const island = islandRef.current
    if (!island) return
    const size = islandSize(island)
    placeAt(DEFAULT_LEFT_PX, DEFAULT_TOP_PX)
    void size
  }, [open, placeAt, position, content, element])

  useEffect(() => {
    if (!open) return
    const handleViewportChange = () => {
      if (!position) return
      const island = islandRef.current
      if (!island) return
      const clamped = clampIslandPosition(position.left, position.top, islandSize(island), viewportSize())
      setPosition(clamped)
    }
    window.addEventListener('resize', handleViewportChange)
    return () => window.removeEventListener('resize', handleViewportChange)
  }, [open, position])

  const handlePointerDown = useIslandHeaderDrag(islandRef, placeAt, setDragging)

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    const delta = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key]
    if (!delta) return
    event.preventDefault()
    const island = islandRef.current
    if (!island) return
    const rect = island.getBoundingClientRect()
    const step = event.shiftKey ? NUDGE_COARSE_STEP_PX : NUDGE_STEP_PX
    placeAt(rect.left + delta[0] * step, rect.top + delta[1] * step)
  }, [placeAt])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!questionDraft.trim() || asking || !canAsk || !element) return
    onAsk()
  }

  const style = position
    ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto', transform: 'none' }
    : undefined

  return (
    <aside
      ref={islandRef}
      className="learn-lens-island dm-island dm-island--summoned dm-learn"
      style={style}
      data-open={open ? 'true' : 'false'}
      data-dragging={dragging ? 'true' : 'false'}
      data-testid="learn-lens-island"
      aria-label="Learn lens"
      aria-hidden={open ? undefined : true}
    >
      <div
        className="dm-learn-head dm-drag-handle"
        data-testid="learn-lens-island-head"
        tabIndex={open ? 0 : -1}
        aria-label="Learn lens — drag or press arrow keys to move"
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
      >
        <span className="dm-learn-title">Learn</span>
        <span className="dm-learn-sub" data-testid="learn-lens-sub">
          {element ? `▢ ${element.label}` : 'click an element'}
        </span>
        <span className="dm-grip" aria-hidden="true">⠿</span>
        <button
          type="button"
          className="dm-island-x"
          aria-label="Close learn lens"
          data-testid="learn-lens-close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="dm-learn-body">
        {!element || !content ? (
          <p className="dm-learn-empty" data-testid="learn-lens-empty">
            Click an element on a captured screen to see its anatomy and the word for what it is doing.
          </p>
        ) : (
          <>
            <pre className="dm-learn-anatomy" data-testid="learn-lens-anatomy">{content.anatomy}</pre>
            <p className="dm-learn-term" data-testid="learn-lens-term">
              <b>{content.vocabularyTerm}</b>: {content.vocabularyDefinition}
            </p>
            <p className="dm-learn-why" data-testid="learn-lens-why">{content.whyLine}</p>
            <form className="learn-ask" onSubmit={handleSubmit}>
              <label className="learn-ask-label" htmlFor="learn-question-input">
                Ask one question about this element
              </label>
              <textarea
                id="learn-question-input"
                className="learn-question-input"
                rows={2}
                value={questionDraft}
                disabled={asking || !canAsk}
                placeholder={canAsk ? 'Why does this read heavier than the others?' : 'Ask a question through the host.'}
                data-testid="learn-question-input"
                onChange={(event) => onQuestionDraftChange(event.target.value)}
              />
              <button
                type="submit"
                className="dm-btn dm-btn--sm learn-ask-submit"
                disabled={asking || !canAsk || !questionDraft.trim()}
                data-testid="learn-question-submit"
              >
                {asking ? 'Asking…' : 'Ask'}
              </button>
              {askError ? (
                <p className="learn-ask-error" role="alert" data-testid="learn-question-error">{askError}</p>
              ) : null}
              {answer ? (
                <div className="learn-answer-block" data-testid="learn-answer-block">
                  <p className="learn-q" data-testid="learn-question-display">You: “{askedQuestion}”</p>
                  <p className="learn-a" data-testid="learn-answer-text">{answer}</p>
                  {pinned ? (
                    <span className="learn-answered dm-mono" data-testid="learn-pinned-status">
                      {`⌁ answered · pinned to canvas at ▢ ${element?.label ?? 'element'}`}
                    </span>
                  ) : (
                    <>
                      <span className="learn-answered dm-mono">⌁ answered · explanation only</span>
                      <button
                        type="button"
                        className="dm-btn dm-btn--sm learn-pin-submit"
                        data-testid="learn-pin-answer"
                        onClick={onPin}
                      >
                        Pin to canvas
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </form>
          </>
        )}
        {frame ? (
          <span className="learn-lens-frame-meta dm-mono" data-testid="learn-lens-frame">
            {frame.label} · {frame.route}
          </span>
        ) : null}
      </div>
    </aside>
  )
}
