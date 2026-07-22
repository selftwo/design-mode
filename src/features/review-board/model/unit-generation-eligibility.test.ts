import { describe, expect, it } from 'vitest'
import { getUnitGenerationEligibility } from './unit-generation-eligibility'
import type { BoardDocument, DesignUnit } from './board-document.schema'

function unit(id: string, overrides: Partial<DesignUnit> = {}): DesignUnit {
  return {
    id,
    label: id,
    brief: `Brief for ${id}`,
    rules: [],
    dependsOnUnitIds: [],
    state: 'open',
    ...overrides,
  }
}

function board(units: DesignUnit[]): BoardDocument {
  return {
    schemaVersion: 2,
    boardId: 'b',
    documentRevision: 1,
    camera: { worldX: 0, worldY: 0, zoom: 1 },
    frames: [],
    annotations: [],
    units,
    zones: [],
    verdicts: [],
    reviewSummaries: [],
  }
}

describe('getUnitGenerationEligibility', () => {
  it('is eligible when a unit has no dependencies', () => {
    const result = getUnitGenerationEligibility(board([unit('a')]), 'a')
    expect(result.kind).toBe('eligible')
  })

  it('is eligible when every dependency is locked', () => {
    const document = board([
      unit('dep', { state: 'locked', lockedFrameId: 'dep-frame' }),
      unit('a', { dependsOnUnitIds: ['dep'] }),
    ])
    // The locked-frame invariant does not matter here; eligibility only reads state.
    expect(getUnitGenerationEligibility(document, 'a').kind).toBe('eligible')
  })

  it('is blocked, in dependency order, when a dependency is still open', () => {
    const document = board([
      unit('first'),
      unit('second'),
      unit('a', { dependsOnUnitIds: ['first', 'second'] }),
    ])
    const result = getUnitGenerationEligibility(document, 'a')
    expect(result).toEqual({ kind: 'blocked', unit: expect.objectContaining({ id: 'a' }), blockingUnitIds: ['first', 'second'] })
  })

  it('lists only the unlocked dependencies as blockers', () => {
    const document = board([
      unit('locked-dep', { state: 'locked', lockedFrameId: 'x' }),
      unit('open-dep'),
      unit('a', { dependsOnUnitIds: ['locked-dep', 'open-dep'] }),
    ])
    const result = getUnitGenerationEligibility(document, 'a')
    expect(result.kind === 'blocked' && result.blockingUnitIds).toEqual(['open-dep'])
  })

  it('is locked even when a dependency is open', () => {
    const document = board([
      unit('open-dep'),
      unit('a', { dependsOnUnitIds: ['open-dep'], state: 'locked', lockedFrameId: 'y' }),
    ])
    expect(getUnitGenerationEligibility(document, 'a').kind).toBe('locked')
  })

  it('is missing for an unknown unit id', () => {
    expect(getUnitGenerationEligibility(board([unit('a')]), 'nope')).toEqual({ kind: 'missing', unitId: 'nope' })
  })
})
