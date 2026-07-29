import type { ScreenFrame } from '../review-board/model/board-document.schema'

// Live iframes are expensive, so only a small active set mounts at once. Cheap
// screenshot shells still render for every frame. Start the cap at 6; measure
// before recording a final value in DECISIONS.md.
export const MAX_MOUNTED_PLAYABLE_OPTIONS = 6

// The React Flow transform (viewport) and the canvas pixel size, enough to
// derive the world-space view without importing React Flow here.
export interface MountView {
  x: number
  y: number
  zoom: number
}

export interface CanvasSize {
  width: number
  height: number
}

export interface MountPolicyInput {
  frames: ScreenFrame[]
  view: MountView
  canvasSize: CanvasSize
  selectedFrameId: string | null
  focusedFrameId: string | null
  // The set mounted right now. Mounting is expensive and remounting loses
  // in-iframe state, so at equal standing an already-mounted frame stays in.
  mountedIds?: Set<string>
  cap?: number
}

interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

function isEmpty(rect: Rect): boolean {
  return rect.right <= rect.left || rect.bottom <= rect.top
}

// The visible canvas mapped into world coordinates.
function worldView(view: MountView, canvasSize: CanvasSize): Rect {
  const zoom = view.zoom || 1
  const left = -view.x / zoom
  const top = -view.y / zoom
  return {
    left,
    top,
    right: left + canvasSize.width / zoom,
    bottom: top + canvasSize.height / zoom,
  }
}

// One full screen of margin on every side, so an option just offscreen is warm
// before it scrolls in.
function expand(rect: Rect): Rect {
  const width = rect.right - rect.left
  const height = rect.bottom - rect.top
  return {
    left: rect.left - width,
    right: rect.right + width,
    top: rect.top - height,
    bottom: rect.bottom + height,
  }
}

function frameRect(frame: ScreenFrame): Rect {
  return { left: frame.x, top: frame.y, right: frame.x + frame.width, bottom: frame.y + frame.height }
}

function intersects(a: Rect, b: Rect): boolean {
  if (isEmpty(a) || isEmpty(b)) return false
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function centerDistanceSq(frame: ScreenFrame, rect: Rect): number {
  const cx = frame.x + frame.width / 2
  const cy = frame.y + frame.height / 2
  const rcx = (rect.left + rect.right) / 2
  const rcy = (rect.top + rect.bottom) / 2
  return (cx - rcx) ** 2 + (cy - rcy) ** 2
}

// Chooses which playable-option frames may mount a live iframe right now. Only
// active or locked options are eligible; archived and killed never mount. The
// selected and focused options are always kept in, even if offscreen, so a
// reviewer working an option never loses its live view. Ranking is stable so the
// mounted set does not churn on redraw, and already-mounted frames win ties so
// panning along the eligibility boundary does not evict and remount them.
//
// When membership is unchanged the caller's `mountedIds` set is returned as-is:
// the selection runs once per pan animation frame, and a stable identity lets
// React memoization skip rebuilding every canvas node.
export function selectLivePlayableFrameIds(input: MountPolicyInput): Set<string> {
  const cap = input.cap ?? MAX_MOUNTED_PLAYABLE_OPTIONS
  const view = worldView(input.view, input.canvasSize)
  const expanded = expand(view)

  const candidates = input.frames
    .map((frame, index) => ({ frame, index }))
    .filter(({ frame }) => frame.kind === 'playable-option' && (frame.lifeState === 'active' || frame.lifeState === 'locked'))
    .map(({ frame, index }) => {
      const rect = frameRect(frame)
      return {
        frame,
        index,
        inView: intersects(rect, view),
        inExpanded: intersects(rect, expanded),
        isSelected: frame.id === input.selectedFrameId,
        isFocused: frame.id === input.focusedFrameId,
        isMounted: input.mountedIds?.has(frame.id) ?? false,
        dist: centerDistanceSq(frame, view),
      }
    })
    .filter((candidate) => candidate.inExpanded || candidate.isSelected || candidate.isFocused)

  candidates.sort((a, b) => {
    if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1
    if (a.isFocused !== b.isFocused) return a.isFocused ? -1 : 1
    if (a.inView !== b.inView) return a.inView ? -1 : 1
    if (a.isMounted !== b.isMounted) return a.isMounted ? -1 : 1
    if (a.dist !== b.dist) return a.dist - b.dist
    if (a.index !== b.index) return a.index - b.index
    return a.frame.id < b.frame.id ? -1 : 1
  })

  const next = new Set(candidates.slice(0, Math.max(0, cap)).map((candidate) => candidate.frame.id))
  const previous = input.mountedIds
  if (previous && previous.size === next.size) {
    let same = true
    for (const id of next) {
      if (!previous.has(id)) {
        same = false
        break
      }
    }
    if (same) return previous
  }
  return next
}
