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

// Automatic placement for verdicts: tile left-to-right inside the zone under
// the label band. Frames keep world coordinates; this only picks x/y.
export function stackFrameInZone(
  zone: Pick<BoardZone, 'x' | 'y' | 'width' | 'height'>,
  frame: Pick<ScreenFrame, 'width' | 'height'>,
  indexInZone: number,
  gap = ZONE_INNER_GAP,
): { x: number; y: number } {
  const innerWidth = Math.max(frame.width, zone.width - ZONE_PADDING * 2)
  const stride = frame.width + gap
  const columns = Math.max(1, Math.floor((innerWidth + gap) / stride))
  const column = indexInZone % columns
  const row = Math.floor(indexInZone / columns)
  return {
    x: zone.x + ZONE_PADDING + column * stride,
    y: zone.y + ZONE_PADDING + ZONE_LABEL_BAND + row * (frame.height + gap),
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
