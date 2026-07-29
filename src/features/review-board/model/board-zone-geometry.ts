import type { BoardDocument, BoardZone, ScreenFrame } from './board-document.schema'
import { isOptionFrame } from './board-relations'

export const ZONE_GAP = 48
export const ZONE_PADDING = 24
export const ZONE_INNER_GAP = 16
export const ZONE_LABEL_BAND = 28
export const DEFAULT_ZONE_HEIGHT = 180
export const EMPTY_UNIT_ZONE_WIDTH = 400

export function frameCenter(
  frame: Pick<ScreenFrame, 'x' | 'y' | 'width' | 'height'>,
): { x: number; y: number } {
  return { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }
}

// Containment is frame-center-in-rect so a drop counts when the reviewer aims
// the middle of the option at the zone, not when a corner merely brushes it.
export function zoneContainsCenter(
  zone: Pick<BoardZone, 'x' | 'y' | 'width' | 'height'>,
  frame: Pick<ScreenFrame, 'x' | 'y' | 'width' | 'height'>,
): boolean {
  const center = frameCenter(frame)
  return center.x >= zone.x
    && center.x <= zone.x + zone.width
    && center.y >= zone.y
    && center.y <= zone.y + zone.height
}

export function unitFrameBounds(
  frames: ScreenFrame[],
  unitId: string,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const members = frames.filter((frame) => frame.unitId === unitId && isOptionFrame(frame))
  if (members.length === 0) return null
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const frame of members) {
    minX = Math.min(minX, frame.x)
    minY = Math.min(minY, frame.y)
    maxX = Math.max(maxX, frame.x + frame.width)
    maxY = Math.max(maxY, frame.y + frame.height)
  }
  return { minX, minY, maxX, maxY }
}

export type ZoneLayoutRects = {
  archive: Pick<BoardZone, 'unitId' | 'kind' | 'x' | 'y' | 'width' | 'height'>
  killed: Pick<BoardZone, 'unitId' | 'kind' | 'x' | 'y' | 'width' | 'height'>
}

// Default world rects: archive below the option row, killed below archive. When
// the unit has no options yet the zones sit at the origin with a fixed width.
export function defaultZoneLayout(
  unitId: string,
  bounds: NonNullable<ReturnType<typeof unitFrameBounds>> | null,
  options: { gap?: number; padding?: number; height?: number } = {},
): ZoneLayoutRects {
  const gap = options.gap ?? ZONE_GAP
  const padding = options.padding ?? ZONE_PADDING
  const height = options.height ?? DEFAULT_ZONE_HEIGHT
  if (!bounds) {
    return {
      archive: { unitId, kind: 'archive', x: 0, y: 0, width: EMPTY_UNIT_ZONE_WIDTH, height },
      killed: { unitId, kind: 'killed', x: 0, y: height + gap, width: EMPTY_UNIT_ZONE_WIDTH, height },
    }
  }
  const width = Math.max(EMPTY_UNIT_ZONE_WIDTH, bounds.maxX - bounds.minX + padding * 2)
  const x = bounds.minX - padding
  const archiveY = bounds.maxY + gap
  return {
    archive: { unitId, kind: 'archive', x, y: archiveY, width, height },
    killed: { unitId, kind: 'killed', x, y: archiveY + height + gap, width, height },
  }
}

// Automatic placement for verdicts: tile entrants left-to-right in rows under
// the label band, below whatever already sits in the zone, so occupants keep
// their place. Row height follows the tallest frame in that row, so mixed
// sizes never overlap. Frames keep world coordinates; the returned bounds grow
// the zone (never shrink it) so every placed frame lies fully inside — a frame
// whose center leaves its zone would otherwise classify as dragged out.
export function stackFramesInZone(
  zone: Pick<BoardZone, 'x' | 'y' | 'width' | 'height'>,
  occupants: readonly Pick<ScreenFrame, 'x' | 'y' | 'width' | 'height'>[],
  entrants: readonly Pick<ScreenFrame, 'width' | 'height'>[],
  gap = ZONE_INNER_GAP,
): {
  positions: { x: number; y: number }[]
  bounds: Pick<BoardZone, 'x' | 'y' | 'width' | 'height'>
} {
  const innerLeft = zone.x + ZONE_PADDING
  const topY = zone.y + ZONE_PADDING + ZONE_LABEL_BAND
  let requiredWidth = zone.width
  let rowY = occupants.reduce(
    (lowest, frame) => Math.max(lowest, frame.y + frame.height + gap),
    topY,
  )
  let cursorX = innerLeft
  let rowHeight = 0
  const positions: { x: number; y: number }[] = []
  for (const frame of entrants) {
    requiredWidth = Math.max(requiredWidth, frame.width + ZONE_PADDING * 2)
    if (cursorX > innerLeft && cursorX + frame.width > zone.x + zone.width - ZONE_PADDING) {
      rowY += rowHeight + gap
      cursorX = innerLeft
      rowHeight = 0
    }
    positions.push({ x: cursorX, y: rowY })
    cursorX += frame.width + gap
    rowHeight = Math.max(rowHeight, frame.height)
  }
  const requiredHeight = positions.length === 0
    ? zone.height
    : Math.max(zone.height, rowY + rowHeight + ZONE_PADDING - zone.y)
  return {
    positions,
    bounds: { x: zone.x, y: zone.y, width: requiredWidth, height: requiredHeight },
  }
}

export function framesInZone(document: BoardDocument, zoneId: string): ScreenFrame[] {
  return document.frames
    .filter((frame) => frame.zoneId === zoneId)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
}

// Zones for the frame's own unit only. If archive and killed overlap (unlikely
// with the default layout), prefer killed so a deliberate strike wins the tie.
export function zoneForDrop(
  document: BoardDocument,
  frame: ScreenFrame,
  position: { x: number; y: number },
): BoardZone | null {
  if (!frame.unitId) return null
  const positioned = { ...frame, x: position.x, y: position.y }
  const candidates = document.zones.filter((zone) => zone.unitId === frame.unitId
    && zoneContainsCenter(zone, positioned))
  if (candidates.length === 0) return null
  return candidates.find((zone) => zone.kind === 'killed')
    ?? candidates.find((zone) => zone.kind === 'archive')
    ?? candidates[0]!
}

export function unitZone(
  document: BoardDocument,
  unitId: string,
  kind: 'archive' | 'killed',
): BoardZone | undefined {
  return document.zones.find((zone) => zone.unitId === unitId && zone.kind === kind)
}
