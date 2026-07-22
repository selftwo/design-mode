import { describe, expect, it, vi } from 'vitest'
import { startUnitGeneration } from './start-unit-generation'
import { LocalHostRequestError } from './local-host-client'
import type { AgentRun } from './host-api.schema'
import type { BoardDocument, DesignUnit } from '../review-board/model/board-document.schema'

function unit(id: string, overrides: Partial<DesignUnit> = {}): DesignUnit {
  return { id, label: id, brief: `Brief ${id}`, rules: [], dependsOnUnitIds: [], state: 'open', ...overrides }
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

function run(): AgentRun {
  return { id: 'run-1', projectId: 'p', agent: 'claude', status: 'queued', annotationIds: [], startedAt: new Date().toISOString(), outputTail: '', unitId: 'a' }
}

describe('startUnitGeneration', () => {
  it('saves the exact board before generating, then reports the run', async () => {
    const calls: string[] = []
    const started = run()
    const document = board([unit('a')])
    const saveImmediately = vi.fn(async (saved: BoardDocument) => {
      calls.push('save')
      expect(saved).toBe(document)
      return { ok: true as const, board: saved }
    })
    const generateOptions = vi.fn(async (input: { unitId: string; count: number }) => {
      calls.push('generate')
      expect(input).toEqual({ unitId: 'a', count: 4 })
      return started
    })

    const result = await startUnitGeneration({ document, unitId: 'a', count: 4, saveImmediately, generateOptions })
    expect(result).toEqual({ kind: 'started', run: started })
    expect(calls).toEqual(['save', 'generate'])
  })

  it('does not save or generate when the unit is not eligible', async () => {
    const document = board([unit('dep'), unit('a', { dependsOnUnitIds: ['dep'] })])
    const saveImmediately = vi.fn(async (saved: BoardDocument) => ({ ok: true as const, board: saved }))
    const generateOptions = vi.fn(async () => run())

    const result = await startUnitGeneration({ document, unitId: 'a', count: 3, saveImmediately, generateOptions })
    expect(result.kind).toBe('ineligible')
    expect(saveImmediately).not.toHaveBeenCalled()
    expect(generateOptions).not.toHaveBeenCalled()
  })

  it('stops without generating when the save fails', async () => {
    const document = board([unit('a')])
    const saveImmediately = vi.fn(async () => ({ ok: false as const, error: 'disk full' }))
    const generateOptions = vi.fn(async () => run())

    const result = await startUnitGeneration({ document, unitId: 'a', count: 3, saveImmediately, generateOptions })
    expect(result).toEqual({ kind: 'save-failed', error: 'disk full' })
    expect(generateOptions).not.toHaveBeenCalled()
  })

  it('maps a 404 to not-found and a 409 to conflict, with one POST each', async () => {
    const document = board([unit('a')])
    const saveImmediately = vi.fn(async (saved: BoardDocument) => ({ ok: true as const, board: saved }))

    const notFound = vi.fn(async () => { throw new LocalHostRequestError('gone', 404) })
    const notFoundResult = await startUnitGeneration({ document, unitId: 'a', count: 3, saveImmediately, generateOptions: notFound })
    expect(notFoundResult).toEqual({ kind: 'not-found', error: 'gone' })
    expect(notFound).toHaveBeenCalledTimes(1)

    const conflict = vi.fn(async () => { throw new LocalHostRequestError('locked', 409) })
    const conflictResult = await startUnitGeneration({ document, unitId: 'a', count: 3, saveImmediately, generateOptions: conflict })
    expect(conflictResult).toEqual({ kind: 'conflict', error: 'locked' })
    expect(conflict).toHaveBeenCalledTimes(1)
  })

  it('maps any other failure to request-failed', async () => {
    const document = board([unit('a')])
    const saveImmediately = vi.fn(async (saved: BoardDocument) => ({ ok: true as const, board: saved }))
    const generateOptions = vi.fn(async () => { throw new Error('network down') })

    const result = await startUnitGeneration({ document, unitId: 'a', count: 3, saveImmediately, generateOptions })
    expect(result).toEqual({ kind: 'request-failed', error: 'network down' })
  })

  it('reports saving then sending stages in order', async () => {
    const document = board([unit('a')])
    const stages: string[] = []
    await startUnitGeneration({
      document,
      unitId: 'a',
      count: 3,
      saveImmediately: async (saved) => ({ ok: true as const, board: saved }),
      generateOptions: async () => run(),
      onStage: (stage) => stages.push(stage),
    })
    expect(stages).toEqual(['saving', 'sending'])
  })
})
