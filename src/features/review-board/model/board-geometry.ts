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
