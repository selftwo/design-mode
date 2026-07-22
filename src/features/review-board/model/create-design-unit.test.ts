import { describe, expect, it } from 'vitest'
import { createDesignUnit } from './create-design-unit'
import { BoardDocumentSchema, type BoardDocument, type DesignUnit } from './board-document.schema'

function unit(id: string, overrides: Partial<DesignUnit> = {}): DesignUnit {
  return { id, label: id, brief: `Brief ${id}`, rules: [], dependsOnUnitIds: [], state: 'open', ...overrides }
}

function board(units: DesignUnit[] = []): BoardDocument {
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

describe('createDesignUnit', () => {
  it('trims fields, splits rules by line, and drops blanks and duplicates', () => {
    const { unit: created } = createDesignUnit(
      board(),
      { label: '  Checkout shell ', brief: '  Pick the shell  ', rulesText: 'One\n\n  Two  \nOne\n', dependsOnUnitIds: [] },
      () => 'aaaaaaaa',
    )
    expect(created.label).toBe('Checkout shell')
    expect(created.brief).toBe('Pick the shell')
    expect(created.rules).toEqual(['One', 'Two'])
    expect(created.state).toBe('open')
    expect(created.id).toBe('checkout-shell-aaaaaaaa')
  })

  it('never sets lock fields on a new unit', () => {
    const { unit: created } = createDesignUnit(board(), { label: 'A', brief: 'b', rulesText: '', dependsOnUnitIds: [] })
    expect(created.nomineeFrameId).toBeUndefined()
    expect(created.lockedFrameId).toBeUndefined()
  })

  it('makes the id unique when the slug plus token already exists', () => {
    const existing = board([unit('a-token123')])
    const { unit: created } = createDesignUnit(existing, { label: 'A', brief: 'b', rulesText: '', dependsOnUnitIds: [] }, () => 'token123')
    expect(created.id).toBe('a-token123-2')
  })

  it('removes duplicate dependency ids while keeping the first order', () => {
    const existing = board([unit('dep-1'), unit('dep-2')])
    const { unit: created } = createDesignUnit(
      existing,
      { label: 'A', brief: 'b', rulesText: '', dependsOnUnitIds: ['dep-2', 'dep-1', 'dep-2'] },
      () => 'aaaaaaaa',
    )
    expect(created.dependsOnUnitIds).toEqual(['dep-2', 'dep-1'])
  })

  it('rejects an unknown dependency id', () => {
    expect(() => createDesignUnit(board([unit('dep-1')]), { label: 'A', brief: 'b', rulesText: '', dependsOnUnitIds: ['ghost'] }))
      .toThrow(/Unknown dependency/)
  })

  it('rejects an empty label or brief', () => {
    expect(() => createDesignUnit(board(), { label: '  ', brief: 'b', rulesText: '', dependsOnUnitIds: [] })).toThrow(/label/)
    expect(() => createDesignUnit(board(), { label: 'A', brief: '  ', rulesText: '', dependsOnUnitIds: [] })).toThrow(/brief/)
  })

  it('returns a document that passes full board validation without mutating the input', () => {
    const source = board([unit('dep-1')])
    const { document: next } = createDesignUnit(source, { label: 'A', brief: 'b', rulesText: 'r1', dependsOnUnitIds: ['dep-1'] }, () => 'aaaaaaaa')
    expect(BoardDocumentSchema.safeParse(next).success).toBe(true)
    expect(next.units).toHaveLength(2)
    expect(source.units).toHaveLength(1)
    expect(next.zones.filter((zone) => zone.unitId === 'a-aaaaaaaa')).toHaveLength(2)
  })
})
