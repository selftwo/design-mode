import { describe, expect, it } from 'vitest'
import { buildUnitQueueRows } from './unit-queue-model'
import type { BoardDocument, DesignUnit } from '../review-board/model/board-document.schema'

function unit(id: string, overrides: Partial<DesignUnit> = {}): DesignUnit {
  return { id, label: id.toUpperCase(), brief: `Brief ${id}`, rules: [], dependsOnUnitIds: [], state: 'open', ...overrides }
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

describe('buildUnitQueueRows', () => {
  it('marks an open unit generatable with an Open label', () => {
    const [row] = buildUnitQueueRows(board([unit('a')]))
    expect(row).toEqual({ id: 'a', label: 'A', state: 'open', stateText: 'Open', canGenerate: true })
  })

  it('names blocking dependencies by label and disables generation', () => {
    const rows = buildUnitQueueRows(board([
      unit('dep', { label: 'Shell' }),
      unit('a', { dependsOnUnitIds: ['dep'] }),
    ]))
    const target = rows.find((row) => row.id === 'a')!
    expect(target.state).toBe('blocked')
    expect(target.stateText).toBe('Blocked by: Shell')
    expect(target.canGenerate).toBe(false)
  })

  it('shows a locked unit as Locked and not generatable', () => {
    const rows = buildUnitQueueRows(board([unit('a', { state: 'locked', lockedFrameId: 'f' })]))
    expect(rows[0]).toMatchObject({ state: 'locked', stateText: 'Locked', canGenerate: false })
  })

  it('keeps units in stored order', () => {
    const rows = buildUnitQueueRows(board([unit('c'), unit('a'), unit('b')]))
    expect(rows.map((row) => row.id)).toEqual(['c', 'a', 'b'])
  })
})
