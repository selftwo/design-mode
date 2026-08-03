import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  clampIslandPosition,
  dodgeIslandPosition,
  type Rect,
} from './island-placement'
import { useIslandHeaderDrag } from './useIslandHeaderDrag'
import './SummonedIsland.css'

const NUDGE_STEP_PX = 8
const NUDGE_COARSE_STEP_PX = 32

function viewportSize(): { width: number; height: number } {
  return { width: window.innerWidth, height: window.innerHeight }
}

function islandSize(element: HTMLElement): { width: number; height: number } {
  const rect = element.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
}

export function SummonedIsland({
  open,
  selectionBounds,
  ariaLabel,
  title,
  testId,
  children,
  className = '',
  onDismiss,
}: {
  open: boolean
  selectionBounds: Rect | null
  ariaLabel: string
  title: string
  testId: string
  children?: ReactNode
  className?: string
  onDismiss?: () => void
}) {
  const islandRef = useRef<HTMLElement>(null)
  const userPlacedRef = useRef(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const applyAutomaticPlacement = useCallback(() => {
    const element = islandRef.current
    if (!element || !open || !selectionBounds || userPlacedRef.current) return
    const size = islandSize(element)
    const obstacles: Rect[] = [selectionBounds]
    document.querySelectorAll<HTMLElement>('.dm-island[data-open="true"]').forEach((other) => {
      if (other === element) return
      const rect = other.getBoundingClientRect()
      obstacles.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
    })
    // Keep the jump-list off the inspector when both are summoned.
    if (testId === 'comments-panel') {
      const inspector = document.querySelector<HTMLElement>('[data-testid="summoned-inspector-island"][data-open="true"]')
      if (inspector) {
        const rect = inspector.getBoundingClientRect()
        obstacles.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
      }
    }
    const placed = dodgeIslandPosition(obstacles, size, viewportSize())
    setPosition({ left: placed.left, top: placed.top })
    window.requestAnimationFrame(() => {
      if (!islandRef.current || userPlacedRef.current || !selectionBounds) return
      const nextSize = islandSize(islandRef.current)
      const nextObstacles: Rect[] = [selectionBounds]
      document.querySelectorAll<HTMLElement>('.dm-island[data-open="true"]').forEach((other) => {
        if (other === islandRef.current) return
        const rect = other.getBoundingClientRect()
        nextObstacles.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
      })
      const resolved = dodgeIslandPosition(nextObstacles, nextSize, viewportSize())
      setPosition({ left: resolved.left, top: resolved.top })
    })
  }, [open, selectionBounds, testId])

  useLayoutEffect(() => {
    applyAutomaticPlacement()
  }, [applyAutomaticPlacement])

  useEffect(() => {
    if (open) return
    userPlacedRef.current = false
    setPosition(null)
  }, [open])

  useEffect(() => {
    if (selectionBounds || userPlacedRef.current) return
    setPosition(null)
  }, [selectionBounds])

  useEffect(() => {
    if (!open) return
    const handleViewportChange = () => {
      if (userPlacedRef.current) {
        const element = islandRef.current
        if (!element || position === null) return
        const clamped = clampIslandPosition(position.left, position.top, islandSize(element), viewportSize())
        setPosition(clamped)
        return
      }
      applyAutomaticPlacement()
    }
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [applyAutomaticPlacement, open, position])

  const placeAt = useCallback((left: number, top: number, remember = true) => {
    const element = islandRef.current
    if (!element) return
    const clamped = clampIslandPosition(left, top, islandSize(element), viewportSize())
    setPosition(clamped)
    if (remember) userPlacedRef.current = true
  }, [])

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
    const element = islandRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const step = event.shiftKey ? NUDGE_COARSE_STEP_PX : NUDGE_STEP_PX
    placeAt(rect.left + delta[0] * step, rect.top + delta[1] * step)
  }, [placeAt])

  const style: CSSProperties | undefined = position
    ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto', transform: 'none' }
    : undefined

  return (
    <aside
      ref={islandRef}
      className={`summoned-island dm-island dm-island--summoned ${className}`.trim()}
      style={style}
      data-open={open ? 'true' : 'false'}
      data-dragging={dragging ? 'true' : 'false'}
      data-testid={testId}
      aria-label={ariaLabel}
      aria-hidden={open ? undefined : true}
    >
      <header
        className="dm-island-head dm-drag-handle"
        data-testid={`${testId}-head`}
        tabIndex={open ? 0 : -1}
        aria-label={`${title} — drag to move; arrow keys nudge`}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
      >
        <h2 className="dm-island-title">{title}</h2>
        <span className="dm-grip" aria-hidden="true">⋮⋮</span>
        {onDismiss ? (
          <button
            type="button"
            className="dm-island-x dm-btn dm-btn--quiet dm-btn--sm"
            aria-label="Dismiss panel"
            data-testid={`${testId}-dismiss`}
            onClick={onDismiss}
          >
            ✕
          </button>
        ) : null}
      </header>
      {children}
    </aside>
  )
}
