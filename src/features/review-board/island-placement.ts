export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface ViewportSize {
  width: number
  height: number
}

export const ISLAND_PLACEMENT_MARGIN = 16
export const ISLAND_PLACEMENT_GAP = 16

export function rectsOverlap(left: Rect, right: Rect): boolean {
  return left.left < right.left + right.width
    && right.left < left.left + left.width
    && left.top < right.top + right.height
    && right.top < left.top + left.height
}

export function clampIslandPosition(
  left: number,
  top: number,
  island: Size,
  viewport: ViewportSize,
  margin = ISLAND_PLACEMENT_MARGIN,
): { left: number; top: number } {
  const maxLeft = Math.max(margin, viewport.width - island.width - margin)
  const maxTop = Math.max(margin, viewport.height - island.height - margin)
  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(margin, top), maxTop),
  }
}

export function dodgeSide(selection: Rect, viewportWidth: number): 'left' | 'right' {
  const centerX = selection.left + selection.width / 2
  if (centerX > viewportWidth / 3 && centerX < (viewportWidth * 2) / 3) {
    const roomOnRight = viewportWidth - (selection.left + selection.width)
    return roomOnRight >= selection.left ? 'right' : 'left'
  }
  return centerX > viewportWidth / 2 ? 'left' : 'right'
}

function overlapsAny(rect: Rect, obstacles: Rect[]): boolean {
  return obstacles.some((obstacle) => rectsOverlap(rect, obstacle))
}

export function dodgeIslandPosition(
  selection: Rect | Rect[],
  island: Size,
  viewport: ViewportSize,
  margin = ISLAND_PLACEMENT_MARGIN,
  gap = ISLAND_PLACEMENT_GAP,
): { left: number; top: number; side: 'left' | 'right' } {
  const obstacles = Array.isArray(selection) ? selection : [selection]
  const primary = obstacles[0] ?? { left: viewport.width / 2, top: viewport.height / 2, width: 0, height: 0 }
  const preferredSide = dodgeSide(primary, viewport.width)
  const sides: Array<'left' | 'right'> = preferredSide === 'left' ? ['left', 'right'] : ['right', 'left']

  for (const side of sides) {
    let left = side === 'left'
      ? margin
      : viewport.width - island.width - margin

    const besideSelection = side === 'left'
      ? primary.left - island.width - gap
      : primary.left + primary.width + gap
    const defaultRect: Rect = { left, top: margin, width: island.width, height: island.height }
    if (overlapsAny(defaultRect, obstacles)) {
      if (side === 'left' && besideSelection >= margin) left = besideSelection
      if (side === 'right' && besideSelection + island.width <= viewport.width - margin) left = besideSelection
    }

    let top = primary.top
    ;({ left, top } = clampIslandPosition(left, top, island, viewport, margin))

    for (let attempt = 0; attempt < obstacles.length + 2; attempt += 1) {
      const candidate: Rect = { left, top, width: island.width, height: island.height }
      const hit = obstacles.find((obstacle) => rectsOverlap(candidate, obstacle))
      if (!hit) return { left, top, side }
      const below = hit.top + hit.height + gap
      const above = hit.top - island.height - gap
      if (below + island.height <= viewport.height - margin) top = below
      else if (above >= margin) top = above
      else break
      ;({ left, top } = clampIslandPosition(left, top, island, viewport, margin))
    }
  }

  const fallback = clampIslandPosition(
    preferredSide === 'left' ? margin : viewport.width - island.width - margin,
    margin,
    island,
    viewport,
    margin,
  )
  return { ...fallback, side: preferredSide }
}
