import { describe, expect, it } from 'vitest'
import { normalizedPathBounds, simplifyNormalizedPath } from './board-geometry'
import type { NormalizedPoint } from './board-document.schema'

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
