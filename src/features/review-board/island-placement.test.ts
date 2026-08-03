import { describe, expect, it } from 'vitest'
import {
  clampIslandPosition,
  dodgeIslandPosition,
  dodgeSide,
  rectsOverlap,
} from './island-placement'

describe('island-placement', () => {
  it('detects overlapping rectangles', () => {
    expect(rectsOverlap(
      { left: 0, top: 0, width: 100, height: 100 },
      { left: 50, top: 50, width: 100, height: 100 },
    )).toBe(true)
    expect(rectsOverlap(
      { left: 0, top: 0, width: 100, height: 100 },
      { left: 100, top: 0, width: 100, height: 100 },
    )).toBe(false)
  })

  it('clamps an island inside the viewport', () => {
    expect(clampIslandPosition(-40, -20, { width: 200, height: 120 }, { width: 800, height: 600 }))
      .toEqual({ left: 16, top: 16 })
    expect(clampIslandPosition(900, 700, { width: 200, height: 120 }, { width: 800, height: 600 }))
      .toEqual({ left: 584, top: 464 })
  })

  it('picks the opposite side for an off-center selection', () => {
    expect(dodgeSide({ left: 700, top: 200, width: 80, height: 40 }, 1000)).toBe('left')
    expect(dodgeSide({ left: 100, top: 200, width: 80, height: 40 }, 1000)).toBe('right')
  })

  it('picks the roomier side for a centered selection', () => {
    expect(dodgeSide({ left: 420, top: 200, width: 160, height: 80 }, 1000)).toBe('right')
    expect(dodgeSide({ left: 500, top: 200, width: 160, height: 80 }, 1000)).toBe('left')
  })

  it('dodges a centered selection without overlapping it or leaving the viewport', () => {
    const selection = { left: 420, top: 260, width: 160, height: 120 }
    const island = { width: 296, height: 320 }
    const viewport = { width: 1000, height: 800 }
    const placed = dodgeIslandPosition(selection, island, viewport)

    expect(placed.left).toBeGreaterThanOrEqual(16)
    expect(placed.top).toBeGreaterThanOrEqual(16)
    expect(placed.left + island.width).toBeLessThanOrEqual(viewport.width - 16)
    expect(placed.top + island.height).toBeLessThanOrEqual(viewport.height - 16)
    expect(rectsOverlap(
      { left: placed.left, top: placed.top, width: island.width, height: island.height },
      selection,
    )).toBe(false)
  })

  it('places beside a selection when the default edge would overlap', () => {
    const selection = { left: 40, top: 120, width: 220, height: 180 }
    const island = { width: 296, height: 280 }
    const viewport = { width: 1000, height: 800 }
    const placed = dodgeIslandPosition(selection, island, viewport)

    expect(placed.side).toBe('right')
    expect(placed.left).toBeGreaterThan(selection.left + selection.width)
    expect(rectsOverlap(
      { left: placed.left, top: placed.top, width: island.width, height: island.height },
      selection,
    )).toBe(false)
  })
})
