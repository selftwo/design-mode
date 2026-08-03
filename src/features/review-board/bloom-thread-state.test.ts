import { describe, expect, it } from 'vitest'
import { bloomThreadStateWord } from './AnnotationBloom'
import type { ReviewAnnotation } from './model/board-document.schema'

function annotation(overrides: Partial<ReviewAnnotation> = {}): ReviewAnnotation {
  return {
    kind: 'review',
    role: 'review',
    id: 'ann-1',
    frameId: 'frame-1',
    status: 'draft',
    instruction: '',
    anchor: [0.5, 0.5],
    mark: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    madeAgainstCaptureHash: 'hash',
    madeAgainstRevision: 1,
    ...overrides,
  }
}

describe('bloomThreadStateWord', () => {
  it('returns draft when the instruction is incomplete', () => {
    expect(bloomThreadStateWord(annotation(), false, false)).toBe('draft')
  })

  it('returns open when the instruction is complete', () => {
    expect(bloomThreadStateWord(annotation({ instruction: 'Ship it' }), false, false)).toBe('open')
  })

  it('returns resolved when the reviewer resolved the thread', () => {
    expect(bloomThreadStateWord(annotation({ instruction: 'Ship it' }), true, false)).toBe('✓ resolved')
  })

  it('returns open for stale threads that are not resolved', () => {
    expect(bloomThreadStateWord(annotation({ instruction: 'Ship it' }), false, true)).toBe('open')
  })
})
