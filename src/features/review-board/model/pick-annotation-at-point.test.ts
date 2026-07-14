import { describe, expect, it } from 'vitest'
import { pickAnnotationAtNormalizedPoint } from './pick-annotation-at-point'
import type { ReviewAnnotation } from './board-document.schema'

function comment(id: string, anchor: [number, number]): ReviewAnnotation {
  return {
    id,
    frameId: 'frame-01',
    status: 'draft',
    instruction: '',
    anchor,
    mark: null,
    createdAt: '2026-07-13T00:00:00.000Z',
    madeAgainstCaptureHash: 'hash',
    madeAgainstRevision: 1,
  }
}

function circle(
  id: string,
  points: [[number, number], [number, number]],
): ReviewAnnotation {
  return {
    id,
    frameId: 'frame-01',
    status: 'draft',
    instruction: '',
    anchor: [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2],
    mark: { kind: 'circle', points },
    createdAt: '2026-07-13T00:00:00.000Z',
    madeAgainstCaptureHash: 'hash',
    madeAgainstRevision: 1,
  }
}

describe('pickAnnotationAtNormalizedPoint', () => {
  it('picks a comment mark at its anchor', () => {
    const annotations = [comment('c1', [0.2, 0.75])]
    expect(pickAnnotationAtNormalizedPoint(annotations, [0.2, 0.75])).toBe('c1')
  })

  it('picks the topmost overlapping circle', () => {
    const annotations = [
      circle('bottom', [[0.1, 0.1], [0.5, 0.5]]),
      circle('top', [[0.2, 0.2], [0.4, 0.4]]),
    ]
    expect(pickAnnotationAtNormalizedPoint(annotations, [0.3, 0.3])).toBe('top')
  })

  it('prefers the selected annotation when shapes overlap', () => {
    const annotations = [
      circle('a', [[0, 0], [0.6, 0.6]]),
      circle('b', [[0.1, 0.1], [0.5, 0.5]]),
    ]
    expect(pickAnnotationAtNormalizedPoint(annotations, [0.3, 0.3], 'a')).toBe('a')
  })
})