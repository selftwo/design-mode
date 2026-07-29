import { describe, expect, it } from 'vitest'
import {
  classifyFrameDragStop,
  moveFrameToArchiveZone,
  restoreFrameFromZone,
} from './move-frame-to-zone'
import { optionBoard } from './verdict-test-support'
import { applyUnitVerdict } from './apply-unit-verdict'

describe('classifyFrameDragStop', () => {
  it('archives an active option dropped on the archive zone', () => {
    const document = optionBoard(['a'])
    const archive = document.zones.find((zone) => zone.kind === 'archive')!
    const intent = classifyFrameDragStop(document, 'a', { x: archive.x + 10, y: archive.y + 10 })
    expect(intent).toEqual({ kind: 'archive', zoneId: archive.id })
  })

  it('requests kill confirmation for a drop on the killed zone', () => {
    const document = optionBoard(['a'])
    const killed = document.zones.find((zone) => zone.kind === 'killed')!
    const intent = classifyFrameDragStop(document, 'a', { x: killed.x + 10, y: killed.y + 10 })
    expect(intent).toEqual({
      kind: 'kill-confirm',
      zoneId: killed.id,
      dropPosition: { x: killed.x + 10, y: killed.y + 10 },
    })
  })

  it('restores an archived frame dragged out of its zone when the unit is open', () => {
    const archived = moveFrameToArchiveZone(
      optionBoard(['a']),
      'a',
      { x: 20, y: 200 },
    )
    expect(archived.ok).toBe(true)
    if (!archived.ok) return
    const intent = classifyFrameDragStop(archived.document, 'a', { x: 0, y: 0 })
    expect(intent).toEqual({ kind: 'restore-active' })
  })

  it('classifies auto-stacked archived frames as still inside their zone', () => {
    // Shrink the archive zone so the third loser must wrap into a second row;
    // the placement math must grow the zone so even that row stays contained.
    const base = optionBoard(['a', 'b', 'c', 'd'])
    const narrowed = {
      ...base,
      zones: base.zones.map((zone) => (zone.kind === 'archive' ? { ...zone, width: 400 } : zone)),
    }
    const promoted = applyUnitVerdict(
      narrowed,
      { unitId: 'unit', frameId: 'a', kind: 'promote', summary: 'lock' },
      () => 'v1',
      () => '2026-07-22T12:00:00.000Z',
    )
    expect(promoted.ok).toBe(true)
    if (!promoted.ok) return
    for (const id of ['b', 'c', 'd']) {
      const frame = promoted.document.frames.find((item) => item.id === id)!
      const intent = classifyFrameDragStop(promoted.document, id, { x: frame.x, y: frame.y })
      expect(intent).toEqual({ kind: 'reposition-only' })
    }
  })

  it('snaps back when a promote-archived frame leaves its zone under a locked unit', () => {
    const promoted = applyUnitVerdict(
      optionBoard(['a', 'b']),
      { unitId: 'unit', frameId: 'a', kind: 'promote', summary: 'lock' },
      () => 'v1',
      () => '2026-07-22T12:00:00.000Z',
    )
    expect(promoted.ok).toBe(true)
    if (!promoted.ok) return
    const intent = classifyFrameDragStop(promoted.document, 'b', { x: -400, y: -400 })
    expect(intent).toEqual({ kind: 'snap-back' })
  })
})

describe('moveFrameToArchiveZone / restoreFrameFromZone', () => {
  it('archives an active option and clears a nominee pointing at it', () => {
    const result = moveFrameToArchiveZone(
      optionBoard(['a', 'b'], { nomineeFrameId: 'a' }),
      'a',
      { x: 30, y: 240 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const frame = result.document.frames.find((item) => item.id === 'a')
    expect(frame?.lifeState).toBe('archived')
    expect(frame?.zoneId).toBeTruthy()
    expect(result.document.units[0]?.nomineeFrameId).toBeUndefined()
  })

  it('restores an archived frame to active and clears its zoneId', () => {
    const archived = moveFrameToArchiveZone(optionBoard(['a']), 'a', { x: 30, y: 240 })
    expect(archived.ok).toBe(true)
    if (!archived.ok) return
    const restored = restoreFrameFromZone(archived.document, 'a', { x: 100, y: 20 })
    expect(restored.ok).toBe(true)
    if (!restored.ok) return
    expect(restored.document.frames.find((frame) => frame.id === 'a')).toMatchObject({
      lifeState: 'active',
      x: 100,
      y: 20,
    })
    expect(restored.document.frames.find((frame) => frame.id === 'a')?.zoneId).toBeUndefined()
  })
})
