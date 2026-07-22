import { describe, expect, it } from 'vitest'
import { BoardDocumentSchema } from './board-document.schema'
import { ensureZonesForAllUnits, ensureZonesForUnit } from './ensure-zones-for-unit'
import { optionBoard } from './verdict-test-support'

describe('ensureZonesForUnit', () => {
  it('creates one archive and one killed zone for a unit', () => {
    const bare = {
      ...optionBoard(['a']),
      zones: [],
    }
    const next = ensureZonesForUnit(bare, 'unit')
    expect(next.zones).toHaveLength(2)
    expect(next.zones.map((zone) => zone.kind).sort()).toEqual(['archive', 'killed'])
    expect(next.zones.every((zone) => zone.unitId === 'unit')).toBe(true)
    expect(BoardDocumentSchema.safeParse(next).success).toBe(true)
  })

  it('is idempotent when both zones already exist', () => {
    const document = optionBoard(['a'])
    const next = ensureZonesForUnit(document, 'unit')
    expect(next.zones).toEqual(document.zones)
  })

  it('backfills every unit on a board', () => {
    const document = {
      ...optionBoard(['a']),
      units: [
        ...optionBoard(['a']).units,
        { id: 'unit-b', label: 'B', brief: 'b', rules: [], dependsOnUnitIds: [], state: 'open' as const },
      ],
      zones: [],
    }
    const next = ensureZonesForAllUnits(document)
    expect(next.zones.filter((zone) => zone.unitId === 'unit')).toHaveLength(2)
    expect(next.zones.filter((zone) => zone.unitId === 'unit-b')).toHaveLength(2)
  })
})
