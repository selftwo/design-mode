import { describe, expect, it } from 'vitest'
import { checkVerdictGesture, unitOptionFrames } from './design-unit-state'
import { optionBoard } from './verdict-test-support'

describe('unitOptionFrames', () => {
  it('returns only the option frames of the named unit', () => {
    const document = optionBoard(['a', 'b'])
    expect(unitOptionFrames(document, 'unit').map((frame) => frame.id)).toEqual(['a', 'b'])
    expect(unitOptionFrames(document, 'other')).toEqual([])
  })
})

describe('checkVerdictGesture', () => {
  it('accepts an active option of an open unit', () => {
    const gate = checkVerdictGesture(optionBoard(['a', 'b']), 'unit', 'a')
    expect(gate.ok).toBe(true)
  })

  it('rejects a missing unit', () => {
    expect(checkVerdictGesture(optionBoard(['a']), 'nope', 'a')).toEqual({ ok: false, block: 'unit-missing' })
  })

  it('rejects a locked unit', () => {
    const document = optionBoard(['a'], { unitState: 'locked', lockedFrameId: 'a', lockedLifeState: 'locked' })
    expect(checkVerdictGesture(document, 'unit', 'a')).toEqual({ ok: false, block: 'unit-locked' })
  })

  it('rejects a missing frame', () => {
    expect(checkVerdictGesture(optionBoard(['a']), 'unit', 'nope')).toEqual({ ok: false, block: 'frame-missing' })
  })

  it('rejects a frame in a different unit', () => {
    const document = optionBoard(['a'])
    // Point the check at the frame under the wrong unit id.
    expect(checkVerdictGesture({ ...document, units: [...document.units, { id: 'other', label: 'Other', brief: 'x', rules: [], dependsOnUnitIds: [], state: 'open' }] }, 'other', 'a'))
      .toEqual({ ok: false, block: 'not-an-option' })
  })

  it('rejects a frame that is no longer active', () => {
    const document = optionBoard(['a'], { firstFrameLifeState: 'archived' })
    expect(checkVerdictGesture(document, 'unit', 'a')).toEqual({ ok: false, block: 'frame-not-active' })
  })
})
