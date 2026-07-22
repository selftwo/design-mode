import { describe, expect, it } from 'vitest'
import {
  defaultZoneLayout,
  frameCenter,
  stackFrameInZone,
  zoneContainsCenter,
  zoneForDrop,
} from './board-zone-geometry'
import { optionBoard } from './verdict-test-support'

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
    const first = stackFrameInZone(zone, { width: 100, height: 80 }, 0)
    const second = stackFrameInZone(zone, { width: 100, height: 80 }, 1)
    expect(second.x).toBeGreaterThan(first.x)
    expect(second.y).toBe(first.y)
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
