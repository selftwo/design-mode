import { describe, expect, it } from 'vitest'
import { createPressureTestBoard } from '@/test-support/create-pressure-test-board'
import { buildBoardListEntry } from './build-board-list-entry'
import type { AgentRun } from '@/features/local-host/host-api.schema'

describe('buildBoardListEntry', () => {
  it('summarizes open threads and the latest run', () => {
    const board = createPressureTestBoard()
    const boardWithNote = {
      ...board,
      boardId: 'smalltools — landing review',
      annotations: [{
        kind: 'review' as const,
        role: 'review' as const,
        id: 'ann-open',
        frameId: 'frame-00',
        status: 'draft' as const,
        instruction: 'Cap the hero measure.',
        intent: 'distill' as const,
        anchor: [0.5, 0.5] as [number, number],
        mark: { kind: 'circle' as const, points: [[0.2, 0.2], [0.4, 0.4]] as [[number, number], [number, number]] },
        replies: [],
        createdAt: '2026-07-17T11:58:00.000Z',
        madeAgainstCaptureHash: board.frames[0]!.captureHash,
        madeAgainstRevision: board.frames[0]!.revision,
      }],
    }
    const runs: AgentRun[] = [{
      id: 'r-142',
      projectId: 'smalltools',
      agent: 'claude',
      status: 'done',
      annotationIds: ['ann-open'],
      startedAt: '2026-07-17T11:59:00.000Z',
      finishedAt: '2026-07-17T11:59:30.000Z',
      outputTail: 'Patch staged.',
    }]
    const entry = buildBoardListEntry('smalltools', 'smalltools', boardWithNote, runs)
    expect(entry.title).toBe('smalltools — landing review')
    expect(entry.openThreadCount).toBe(1)
    expect(entry.thumbUrls).toHaveLength(3)
    expect(entry.latestRun?.id).toBe('r-142')
  })
})
