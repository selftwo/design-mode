import { describe, expect, it } from 'vitest'
import { applyUnitVerdict } from './apply-unit-verdict'
import { BoardDocumentSchema, type BoardDocument, type BoardZone, type ScreenFrame } from './board-document.schema'
import { optionBoard } from './verdict-test-support'

function frameFullyInsideZone(zone: BoardZone, frame: ScreenFrame): boolean {
  return frame.x >= zone.x
    && frame.y >= zone.y
    && frame.x + frame.width <= zone.x + zone.width
    && frame.y + frame.height <= zone.y + zone.height
}

// Shrinks the archive zone so stacked losers must wrap into a second row.
function withNarrowArchiveZone(document: BoardDocument): BoardDocument {
  return {
    ...document,
    zones: document.zones.map((zone) => (zone.kind === 'archive' ? { ...zone, width: 400 } : zone)),
  }
}

const ids = () => 'fixed-verdict-id'
const now = () => new Date('2026-07-22T12:00:00.000Z').toISOString()

describe('applyUnitVerdict promote', () => {
  it('locks the unit, locks the winner, archives siblings, and appends one row', () => {
    const document = optionBoard(['a', 'b', 'c'], { nomineeFrameId: 'b' })
    const result = applyUnitVerdict(document, { unitId: 'unit', frameId: 'a', kind: 'promote', summary: '  keep a  ' }, ids, now)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const unit = result.document.units[0]!
    expect(unit.state).toBe('locked')
    expect(unit.lockedFrameId).toBe('a')
    // Promotion clears any leading nominee, so no archived frame is left nominated.
    expect(unit.nomineeFrameId).toBeUndefined()

    const byId = Object.fromEntries(result.document.frames.map((frame) => [frame.id, frame.lifeState]))
    expect(byId).toEqual({ a: 'locked', b: 'archived', c: 'archived' })

    expect(result.document.verdicts).toHaveLength(1)
    expect(result.document.verdicts[0]).toEqual({
      id: 'fixed-verdict-id',
      unitId: 'unit',
      frameId: 'a',
      kind: 'promote',
      summary: 'keep a',
      createdAt: now(),
      kitSnapshot: { expand: false },
      referenceFrameIds: [],
    })
  })

  it('carries the linked references onto the verdict, de-duplicated', () => {
    const result = applyUnitVerdict(
      optionBoard(['a', 'b']),
      { unitId: 'unit', frameId: 'a', kind: 'promote', summary: 'locked', referenceFrameIds: ['ref-1', 'ref-2', 'ref-1'] },
      ids,
      now,
    )
    expect(result.ok && result.document.verdicts[0]?.referenceFrameIds).toEqual(['ref-1', 'ref-2'])
  })

  it('records the winner kit state at the moment of the verdict', () => {
    const base = optionBoard(['a', 'b'])
    // The reviewer flipped the winner's toggle before promoting.
    const withKit = {
      ...base,
      frames: base.frames.map((frame) => frame.id === 'a' && frame.kit
        ? { ...frame, kit: { ...frame.kit, state: { expand: true } } }
        : frame),
    }
    const result = applyUnitVerdict(withKit, { unitId: 'unit', frameId: 'a', kind: 'promote', summary: 'locked' }, ids, now)
    expect(result.ok && result.document.verdicts[0]?.kitSnapshot).toEqual({ expand: true })
  })

  it('produces a document that still validates against the full schema', () => {
    const result = applyUnitVerdict(optionBoard(['a', 'b']), { unitId: 'unit', frameId: 'a', kind: 'promote', summary: 'locked' }, ids, now)
    expect(result.ok).toBe(true)
    if (result.ok) expect(() => BoardDocumentSchema.parse(result.document)).not.toThrow()
  })

  it('does not touch a sibling that was already archived', () => {
    const document = optionBoard(['a', 'b'], { firstFrameLifeState: 'active' })
    const archiveId = document.zones.find((zone) => zone.kind === 'archive')!.id
    const preArchived = {
      ...document,
      frames: document.frames.map((frame) => frame.id === 'b'
        ? { ...frame, lifeState: 'archived' as const, zoneId: archiveId }
        : frame),
    }
    const result = applyUnitVerdict(preArchived, { unitId: 'unit', frameId: 'a', kind: 'promote', summary: 'locked' }, ids, now)
    expect(result.ok && result.document.frames.find((frame) => frame.id === 'b')?.lifeState).toBe('archived')
    expect(result.ok && result.document.frames.find((frame) => frame.id === 'b')?.zoneId).toBe(archiveId)
  })

  it('places archived losers into the unit archive zone', () => {
    const result = applyUnitVerdict(optionBoard(['a', 'b', 'c']), { unitId: 'unit', frameId: 'a', kind: 'promote', summary: 'locked' }, ids, now)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const archive = result.document.zones.find((zone) => zone.unitId === 'unit' && zone.kind === 'archive')
    expect(archive).toBeTruthy()
    expect(result.document.frames.find((frame) => frame.id === 'b')).toMatchObject({ lifeState: 'archived', zoneId: archive!.id })
    expect(result.document.frames.find((frame) => frame.id === 'c')).toMatchObject({ lifeState: 'archived', zoneId: archive!.id })
    expect(result.document.frames.find((frame) => frame.id === 'a')?.zoneId).toBeUndefined()
  })

  it('grows the archive zone so every stacked loser lies fully inside it', () => {
    const result = applyUnitVerdict(optionBoard(['a', 'b', 'c']), { unitId: 'unit', frameId: 'a', kind: 'promote', summary: 'locked' }, ids, now)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const archive = result.document.zones.find((zone) => zone.kind === 'archive')!
    for (const id of ['b', 'c']) {
      const frame = result.document.frames.find((item) => item.id === id)!
      expect(frameFullyInsideZone(archive, frame)).toBe(true)
    }
  })

  it('stacks a second row inside the archive zone when the first row is full', () => {
    const document = withNarrowArchiveZone(optionBoard(['a', 'b', 'c']))
    const result = applyUnitVerdict(document, { unitId: 'unit', frameId: 'a', kind: 'promote', summary: 'locked' }, ids, now)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const archive = result.document.zones.find((zone) => zone.kind === 'archive')!
    const b = result.document.frames.find((item) => item.id === 'b')!
    const c = result.document.frames.find((item) => item.id === 'c')!
    // A 400-wide zone fits one 220-wide frame per row, so c wraps below b.
    expect(c.y).toBeGreaterThanOrEqual(b.y + b.height)
    expect(frameFullyInsideZone(archive, b)).toBe(true)
    expect(frameFullyInsideZone(archive, c)).toBe(true)
  })
})

describe('applyUnitVerdict kill', () => {
  it('kills the frame, keeps the unit open, and appends one kill row', () => {
    const result = applyUnitVerdict(optionBoard(['a', 'b']), { unitId: 'unit', frameId: 'a', kind: 'kill', summary: 'too dense' }, ids, now)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.units[0]!.state).toBe('open')
    expect(result.document.frames.find((frame) => frame.id === 'a')?.lifeState).toBe('killed')
    expect(result.document.frames.find((frame) => frame.id === 'b')?.lifeState).toBe('active')
    expect(result.document.verdicts[0]).toMatchObject({ kind: 'kill', frameId: 'a', summary: 'too dense' })
  })

  it('places the killed frame into the unit killed zone', () => {
    const result = applyUnitVerdict(optionBoard(['a', 'b']), { unitId: 'unit', frameId: 'a', kind: 'kill', summary: 'too dense' }, ids, now)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const killed = result.document.zones.find((zone) => zone.unitId === 'unit' && zone.kind === 'killed')
    expect(killed).toBeTruthy()
    expect(result.document.frames.find((frame) => frame.id === 'a')).toMatchObject({
      lifeState: 'killed',
      zoneId: killed!.id,
    })
  })

  it('keeps a drag drop position when placement is provided', () => {
    const result = applyUnitVerdict(
      optionBoard(['a', 'b']),
      { unitId: 'unit', frameId: 'a', kind: 'kill', summary: 'dragged', placement: { x: 40, y: 520 } },
      ids,
      now,
    )
    expect(result.ok && result.document.frames.find((frame) => frame.id === 'a')).toMatchObject({
      x: 40,
      y: 520,
      lifeState: 'killed',
    })
  })

  it('clears a nominee that pointed at the killed frame', () => {
    const result = applyUnitVerdict(optionBoard(['a', 'b'], { nomineeFrameId: 'a' }), { unitId: 'unit', frameId: 'a', kind: 'kill', summary: 'no' }, ids, now)
    expect(result.ok && result.document.units[0]!.nomineeFrameId).toBeUndefined()
  })

  it('leaves a nominee on a different frame untouched', () => {
    const result = applyUnitVerdict(optionBoard(['a', 'b'], { nomineeFrameId: 'b' }), { unitId: 'unit', frameId: 'a', kind: 'kill', summary: 'no' }, ids, now)
    expect(result.ok && result.document.units[0]!.nomineeFrameId).toBe('b')
  })

  it('grows the killed zone so the stacked frame lies fully inside it', () => {
    const result = applyUnitVerdict(optionBoard(['a', 'b']), { unitId: 'unit', frameId: 'a', kind: 'kill', summary: 'gone' }, ids, now)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const killed = result.document.zones.find((zone) => zone.kind === 'killed')!
    const frame = result.document.frames.find((item) => item.id === 'a')!
    expect(frameFullyInsideZone(killed, frame)).toBe(true)
  })
})

describe('applyUnitVerdict rejection', () => {
  it('rejects an empty summary', () => {
    const result = applyUnitVerdict(optionBoard(['a']), { unitId: 'unit', frameId: 'a', kind: 'promote', summary: '   ' }, ids, now)
    expect(result).toEqual({ ok: false, reason: 'empty-summary' })
  })

  it('rejects a verdict on a locked unit', () => {
    const document = optionBoard(['a', 'b'], { unitState: 'locked', lockedFrameId: 'a', lockedLifeState: 'locked' })
    const result = applyUnitVerdict(document, { unitId: 'unit', frameId: 'b', kind: 'kill', summary: 'late' }, ids, now)
    expect(result).toEqual({ ok: false, reason: 'unit-locked' })
  })

  it('rejects a verdict on a non-active frame', () => {
    const document = optionBoard(['a', 'b'], { firstFrameLifeState: 'archived' })
    const result = applyUnitVerdict(document, { unitId: 'unit', frameId: 'a', kind: 'promote', summary: 'no' }, ids, now)
    expect(result).toEqual({ ok: false, reason: 'frame-not-active' })
  })
})
