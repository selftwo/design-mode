import { describe, expect, it } from 'vitest'
import { createPressureTestBoard } from '@/test-support/create-pressure-test-board'
import { buildReviewBatch, ReviewBatchSchema } from './review-batch'

describe('buildReviewBatch', () => {
  it('builds a versioned batch with board identity and every draft annotation', () => {
    const board = createPressureTestBoard()
    const result = buildReviewBatch(board, '2026-07-14T00:00:00.000Z')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.batch.schemaVersion).toBe(1)
    expect(result.batch.boardId).toBe(board.boardId)
    expect(result.batch.exportedAt).toBe('2026-07-14T00:00:00.000Z')
    expect(result.batch.annotations).toHaveLength(board.annotations.length)
    expect(ReviewBatchSchema.parse(result.batch)).toEqual(result.batch)
  })

  it('exports freehand path marks and element marks with their picked element', () => {
    const board = createPressureTestBoard()
    const frame = board.frames[0]!
    const withNewMarks = {
      ...board,
      annotations: [
        {
          ...board.annotations[0]!,
          id: 'ink-note',
          instruction: 'Tighten the drawn area',
          mark: { kind: 'path' as const, points: [[0.2, 0.2], [0.5, 0.25], [0.4, 0.5], [0.21, 0.22]] as [number, number][] },
        },
        {
          ...board.annotations[0]!,
          id: 'element-note',
          instruction: 'Align this pane with the grid',
          mark: {
            kind: 'element' as const,
            elementId: `${frame.id}-el-3`,
            label: 'Scenarios pane',
            points: [[0.1, 0.3], [0.4, 0.8]] as [[number, number], [number, number]],
          },
        },
      ],
    }
    const result = buildReviewBatch(withNewMarks)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const ink = result.batch.annotations.find((item) => item.id === 'ink-note')!
    expect(ink.marks).toEqual([withNewMarks.annotations[0]!.mark])
    expect(ink.elements).toEqual([])
    const picked = result.batch.annotations.find((item) => item.id === 'element-note')!
    expect(picked.elements).toEqual([
      { id: `${frame.id}-el-3`, label: 'Scenarios pane', bounds: [[0.1, 0.3], [0.4, 0.8]] },
    ])
  })

  it('contains no coding agent, model, command, or vendor field', () => {
    const board = createPressureTestBoard()
    const result = buildReviewBatch(board)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const serialized = JSON.stringify(result.batch).toLowerCase()
    for (const banned of ['agent', 'model', 'command', 'vendor', 'claude', 'codex', 'cmux']) {
      expect(serialized).not.toContain(banned)
    }
  })

  it('blocks export and identifies annotations with empty instructions', () => {
    const board = createPressureTestBoard()
    const blocked = {
      ...board,
      annotations: board.annotations.map((annotation, index) => index === 0
        ? { ...annotation, instruction: '   ' }
        : annotation),
    }
    const result = buildReviewBatch(blocked)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.blocks).toEqual([{ annotationId: blocked.annotations[0]!.id, reason: 'incomplete-instruction' }])
  })

  it('blocks export and identifies annotations with an absolute screenshot path', () => {
    const board = createPressureTestBoard()
    const frameId = board.annotations[0]!.frameId
    const withAbsolutePath = {
      ...board,
      frames: board.frames.map((frame) => frame.id === frameId
        ? { ...frame, screenshotPath: '/etc/passwd' }
        : frame),
    }
    const result = buildReviewBatch(withAbsolutePath)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.blocks).toContainEqual({ annotationId: board.annotations[0]!.id, reason: 'absolute-screenshot-path' })
  })

  it('carries the design intent of an annotation into the batch', () => {
    const board = createPressureTestBoard()
    const withIntent = {
      ...board,
      annotations: board.annotations.map((annotation, index) => index === 0
        ? { ...annotation, intent: 'typeset' as const }
        : annotation),
    }
    const result = buildReviewBatch(withIntent)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.batch.annotations[0]!.intent).toBe('typeset')
    expect(result.batch.annotations[1]!.intent).toBeUndefined()
  })

  it('builds an empty batch when the board has no annotations', () => {
    const board = createPressureTestBoard()
    const result = buildReviewBatch({ ...board, annotations: [] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.batch.annotations).toEqual([])
  })

  it('excludes agent-question and teach annotations from the dispatch batch', () => {
    const board = createPressureTestBoard()
    const withAgentRows = {
      ...board,
      annotations: [
        ...board.annotations,
        {
          ...board.annotations[0]!,
          id: 'agent-q',
          role: 'agent-question' as const,
          instruction: 'What is this panel?',
          runId: 'run-1',
          canvasEventId: 'agent-q',
        },
        {
          ...board.annotations[0]!,
          id: 'teach-1',
          role: 'teach' as const,
          instruction: 'This is the side rail.',
          runId: 'run-1',
          canvasEventId: 'teach-1',
        },
      ],
    }
    const result = buildReviewBatch(withAgentRows)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.batch.annotations).toHaveLength(board.annotations.length)
    expect(result.batch.annotations.find((item) => item.id === 'agent-q')).toBeUndefined()
    expect(result.batch.annotations.find((item) => item.id === 'teach-1')).toBeUndefined()
  })
})
