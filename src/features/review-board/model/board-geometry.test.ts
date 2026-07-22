import { describe, expect, it } from 'vitest'
import { normalizedPathBounds, projectNormalizedPoint, resizeFrameAspectLocked, simplifyNormalizedPath } from './board-geometry'
import type { NormalizedPoint, ScreenFrame } from './board-document.schema'

function frameFixture(overrides: Partial<ScreenFrame> = {}): ScreenFrame {
  return {
    id: 'f1',
    label: 'Frame',
    route: '/',
    viewport: { width: 800, height: 1000 },
    x: 100,
    y: 50,
    width: 400,
    height: 500,
    aspectRatio: 400 / 500,
    screenshotPath: 'shot.png',
    screenshotDataUrl: 'data:image/png;base64,x',
    refreshedScreenshotDataUrl: 'data:image/png;base64,x',
    captureHash: 'hash',
    revision: 1,
    elements: [],
    kind: 'captured-route',
    lifeState: 'active',
    ...overrides,
  }
}

describe('normalizedPathBounds', () => {
  it('covers a freehand loop that ends where it started', () => {
    const loop: NormalizedPoint[] = [
      [0.4, 0.2],
      [0.7, 0.35],
      [0.6, 0.6],
      [0.3, 0.5],
      [0.41, 0.21],
    ]
    expect(normalizedPathBounds(loop)).toEqual([[0.3, 0.2], [0.7, 0.6]])
  })

  it('matches a straight drag from start to end', () => {
    expect(normalizedPathBounds([[0.2, 0.3], [0.5, 0.7]])).toEqual([[0.2, 0.3], [0.5, 0.7]])
  })

  it('collapses a single point to a zero-size box', () => {
    expect(normalizedPathBounds([[0.5, 0.5]])).toEqual([[0.5, 0.5], [0.5, 0.5]])
  })

  it('returns the origin box for an empty path', () => {
    expect(normalizedPathBounds([])).toEqual([[0, 0], [0, 0]])
  })
})

describe('simplifyNormalizedPath', () => {
  it('drops points closer than the minimum distance but keeps both ends', () => {
    const jitter: NormalizedPoint[] = [
      [0.1, 0.1],
      [0.101, 0.1],
      [0.102, 0.101],
      [0.3, 0.3],
      [0.301, 0.301],
      [0.5, 0.5],
    ]
    expect(simplifyNormalizedPath(jitter)).toEqual([[0.1, 0.1], [0.3, 0.3], [0.5, 0.5]])
  })

  it('resamples very long drawings down to the schema cap', () => {
    const long: NormalizedPoint[] = Array.from({ length: 2000 }, (_, index) => [
      (index % 1000) / 1000,
      Math.floor(index / 1000) / 2,
    ])
    const simplified = simplifyNormalizedPath(long, 0.0001, 256)
    expect(simplified.length).toBeLessThanOrEqual(256)
    expect(simplified[0]).toEqual(long[0])
    expect(simplified[simplified.length - 1]).toEqual(long[long.length - 1])
  })

  it('keeps a click as a single point', () => {
    expect(simplifyNormalizedPath([[0.4, 0.4]])).toEqual([[0.4, 0.4]])
  })
})

describe('resizeFrameAspectLocked', () => {
  it('scales width and derives height from the locked aspect ratio', () => {
    const resized = resizeFrameAspectLocked(frameFixture(), 800)
    expect(resized.width).toBe(800)
    expect(resized.height).toBe(1000)
  })

  it('never shrinks below the minimum width', () => {
    const resized = resizeFrameAspectLocked(frameFixture(), 40)
    expect(resized.width).toBe(120)
    expect(resized.height).toBeCloseTo(150)
  })

  it('keeps a normalized mark pinned to the same relative spot after resize', () => {
    const frame = frameFixture()
    const mark: NormalizedPoint = [0.25, 0.8]
    const before = projectNormalizedPoint(frame, mark)
    // the mark sits at a known fraction of the frame before resizing
    expect((before.x - frame.x) / frame.width).toBeCloseTo(0.25)
    expect((before.y - frame.y) / frame.height).toBeCloseTo(0.8)

    const resized = resizeFrameAspectLocked(frame, 640)
    const after = projectNormalizedPoint(resized, mark)
    // normalized coordinates are unchanged, so the mark tracks the same fraction
    expect((after.x - resized.x) / resized.width).toBeCloseTo(0.25)
    expect((after.y - resized.y) / resized.height).toBeCloseTo(0.8)
  })
})
