import { describe, expect, it } from 'vitest'
import { buildScopeChipLabel } from './build-scope-chip-label'
import type { ReviewAnnotation } from './model/board-document.schema'

function annotation(overrides: Partial<ReviewAnnotation> = {}): ReviewAnnotation {
  return {
    kind: 'review',
    id: 'ann-1',
    frameId: 'frame-1',
    status: 'draft',
    instruction: '',
    anchor: [0.5, 0.5],
    mark: { kind: 'circle', points: [[0.4, 0.4], [0.6, 0.6]] },
    createdAt: '2026-01-01T00:00:00.000Z',
    madeAgainstCaptureHash: 'hash',
    madeAgainstRevision: 1,
    ...overrides,
  }
}

describe('buildScopeChipLabel', () => {
  it('labels live circle marks with their ordinal', () => {
    const pool = [annotation(), annotation({ id: 'ann-2', mark: null })]
    expect(buildScopeChipLabel(pool[0]!, pool, false)).toBe('○ circle · #1')
    expect(buildScopeChipLabel(pool[1]!, pool, false)).toBe('pin · #2')
  })

  it('labels stale marks without alarmist wording', () => {
    const pool = [annotation({ mark: { kind: 'element', elementId: 'el-1', label: 'Pay', points: [[0, 0], [1, 1]] } })]
    expect(buildScopeChipLabel(pool[0]!, pool, true)).toBe('▢ element · stale')
  })
})
