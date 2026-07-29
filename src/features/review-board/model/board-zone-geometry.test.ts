import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ZONE_HEIGHT,
  defaultZoneLayout,
  frameCenter,
  stackFramesInZone,
  zoneContainsCenter,
  zoneForDrop,
} from './board-zone-geometry'
import { optionBoard } from './verdict-test-support'

function frameInsideBounds(
  bounds: { x: number; y: number; width: number; height: number },
  frame: { width: number; height: number },
  position: { x: number; y: number },
): boolean {
  return position.x >= bounds.x
    && position.y >= bounds.y
    && position.x + frame.width <= bounds.x + bounds.width
    && position.y + frame.height <= bounds.y + bounds.height
}

describe('board-zone-geometry', () => {
  it('treats containment as frame-center-in-rect', () => {
    const zone = { x: 0, y: 0, width: 100, height: 100 }
    expect(zoneContainsCenter(zone, { x: 40, y: 40, width: 20, height: 20 })).toBe(true)
    // Top-left inside the zone but center outside.
    expect(zoneContainsCenter(zone, { x: 90, y: 90, width: 40, height: 40 })).toBe(false)
    expect(frameCenter({ x: 10, y: 20, width: 40, height: 10 })).toEqual({ x: 30, y: 25 })
  })

  it('lays archive below the option row and killed below archive', () => {
    const layout = defaultZoneLayout('unit', { minX: 0, minY: 0, maxX: 500, maxY: 140 })
    expect(layout.archive.y).toBeGreaterThan(140)
    expect(layout.killed.y).toBeGreaterThan(layout.archive.y + layout.archive.height)
    expect(layout.archive.width).toBeGreaterThanOrEqual(500)
  })

  it('stacks frames left to right inside a zone', () => {
    const zone = { x: 10, y: 20, width: 600, height: 200 }
    const { positions } = stackFramesInZone(zone, [], [
      { width: 100, height: 80 },
      { width: 100, height: 80 },
    ])
    expect(positions[1]!.x).toBeGreaterThan(positions[0]!.x)
    expect(positions[1]!.y).toBe(positions[0]!.y)
  })

  it('keeps a first-row frame fully inside the returned zone bounds', () => {
    const zone = { x: 0, y: 0, width: 400, height: DEFAULT_ZONE_HEIGHT }
    const frame = { width: 220, height: 137.5 }
    const { positions, bounds } = stackFramesInZone(zone, [], [frame])
    // Padding + label band + a default option frame overflow the default zone
    // height, so the bounds must grow instead of leaving the frame hanging out.
    expect(bounds.height).toBeGreaterThan(DEFAULT_ZONE_HEIGHT)
    expect(frameInsideBounds(bounds, frame, positions[0]!)).toBe(true)
  })

  it('wraps into rows and keeps every row fully inside the returned bounds', () => {
    const zone = { x: 0, y: 0, width: 400, height: DEFAULT_ZONE_HEIGHT }
    const frames = [
      { width: 220, height: 137.5 },
      { width: 220, height: 137.5 },
      { width: 220, height: 137.5 },
    ]
    const { positions, bounds } = stackFramesInZone(zone, [], frames)
    // Only one 220-wide frame fits per 400-wide row, so rows must stack.
    expect(positions[1]!.y).toBeGreaterThan(positions[0]!.y)
    expect(positions[2]!.y).toBeGreaterThan(positions[1]!.y)
    frames.forEach((frame, index) => {
      expect(frameInsideBounds(bounds, frame, positions[index]!)).toBe(true)
    })
  })

  it('sizes each row by its tallest frame so mixed heights never overlap', () => {
    const zone = { x: 0, y: 0, width: 500, height: DEFAULT_ZONE_HEIGHT }
    const frames = [
      { width: 200, height: 80 },
      { width: 200, height: 160 },
      { width: 200, height: 100 },
    ]
    const { positions, bounds } = stackFramesInZone(zone, [], frames)
    // Frames 0 and 1 share the first row; frame 2 starts below the taller one.
    expect(positions[1]!.y).toBe(positions[0]!.y)
    expect(positions[2]!.y).toBeGreaterThanOrEqual(positions[1]!.y + 160)
    frames.forEach((frame, index) => {
      expect(frameInsideBounds(bounds, frame, positions[index]!)).toBe(true)
    })
  })

  it('starts new frames below existing occupants without moving them', () => {
    const zone = { x: 0, y: 0, width: 500, height: 400 }
    const occupant = { x: 24, y: 52, width: 200, height: 100 }
    const { positions, bounds } = stackFramesInZone(zone, [occupant], [{ width: 200, height: 100 }])
    expect(positions[0]!.y).toBeGreaterThanOrEqual(occupant.y + occupant.height)
    expect(frameInsideBounds(bounds, { width: 200, height: 100 }, positions[0]!)).toBe(true)
  })

  it('returns unchanged bounds when there is nothing to place', () => {
    const zone = { x: 5, y: 7, width: 400, height: 180 }
    const { positions, bounds } = stackFramesInZone(zone, [], [])
    expect(positions).toEqual([])
    expect(bounds).toEqual({ x: 5, y: 7, width: 400, height: 180 })
  })

  it('prefers a killed zone over an archive zone on overlapping drops', () => {
    const document = optionBoard(['a'])
    const archive = document.zones.find((zone) => zone.kind === 'archive')!
    const killed = {
      ...document.zones.find((zone) => zone.kind === 'killed')!,
      x: archive.x,
      y: archive.y,
      width: archive.width,
      height: archive.height,
    }
    const overlapping = {
      ...document,
      zones: [archive, killed],
    }
    const frame = overlapping.frames[0]!
    const drop = zoneForDrop(overlapping, frame, { x: archive.x + 10, y: archive.y + 10 })
    expect(drop?.kind).toBe('killed')
  })
})
