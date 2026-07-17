import type { NormalizedPoint, ScreenFrame } from './board-document.schema'

export function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function normalizeLocalPoint(
  point: readonly [number, number],
  width: number,
  height: number,
): NormalizedPoint {
  return [clampUnit(point[0] / width), clampUnit(point[1] / height)]
}

// A freehand circling gesture ends near its own start, so the drawn mark must come
// from the whole pointer path, not the down/up pair.
export function normalizedPathBounds(
  path: readonly NormalizedPoint[],
): readonly [NormalizedPoint, NormalizedPoint] {
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const [x, y] of path) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  if (path.length === 0) return [[0, 0], [0, 0]]
  return [[minX, minY], [maxX, maxY]]
}

// Raw pointer moves arrive per frame; storing every one bloats the board and the
// export. Keep points that move at least minDistance, then resample if the drawing
// is still longer than maxPoints (the mark schema caps path length).
export function simplifyNormalizedPath(
  path: readonly NormalizedPoint[],
  minDistance = 0.0075,
  maxPoints = 256,
): NormalizedPoint[] {
  if (path.length === 0) return []
  const kept: NormalizedPoint[] = [path[0]!]
  for (let index = 1; index < path.length - 1; index += 1) {
    const point = path[index]!
    const last = kept[kept.length - 1]!
    const dx = point[0] - last[0]
    const dy = point[1] - last[1]
    if (dx * dx + dy * dy >= minDistance * minDistance) kept.push(point)
  }
  if (path.length > 1) kept.push(path[path.length - 1]!)
  if (kept.length <= maxPoints) return kept
  const step = (kept.length - 1) / (maxPoints - 1)
  return Array.from({ length: maxPoints }, (_, index) => kept[Math.round(index * step)]!)
}

export function projectNormalizedPoint(
  frame: Pick<ScreenFrame, 'x' | 'y' | 'width' | 'height'>,
  point: NormalizedPoint,
): { x: number; y: number } {
  return {
    x: frame.x + point[0] * frame.width,
    y: frame.y + point[1] * frame.height,
  }
}

export function resizeFrameAspectLocked(frame: ScreenFrame, width: number): ScreenFrame {
  const safeWidth = Math.max(120, width)
  return {
    ...frame,
    width: safeWidth,
    height: safeWidth / frame.aspectRatio,
  }
}

export function containingFrame(
  frames: ScreenFrame[],
  worldPoint: { x: number; y: number },
): ScreenFrame | null {
  return [...frames].reverse().find((frame) => {
    return worldPoint.x >= frame.x && worldPoint.x <= frame.x + frame.width
      && worldPoint.y >= frame.y && worldPoint.y <= frame.y + frame.height
  }) ?? null
}
