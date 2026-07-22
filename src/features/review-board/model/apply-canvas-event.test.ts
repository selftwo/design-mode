import { describe, expect, it } from 'vitest'
import { createPressureTestBoard } from '@/test-support/create-pressure-test-board'
import { applyCanvasEvent } from './apply-canvas-event'
import type { CanvasEvent } from './canvas-event.schema'

function questionEvent(overrides: Partial<Extract<CanvasEvent, { type: 'question' }>> = {}): Extract<CanvasEvent, { type: 'question' }> {
  return {
    schemaVersion: 1,
    id: 'q-1',
    type: 'question',
    runId: 'run-1',
    frameId: 'frame-00',
    anchor: [0.4, 0.3],
    text: 'What is this header for?',
    createdAt: '2026-07-22T00:00:00.000Z',
    ...overrides,
  }
}

describe('applyCanvasEvent', () => {
  it('lands a question as an agent-question annotation', () => {
    const board = createPressureTestBoard()
    const result = applyCanvasEvent(board, questionEvent())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.applied).toBe(true)
    expect(result.annotation).toMatchObject({
      id: 'q-1',
      role: 'agent-question',
      instruction: 'What is this header for?',
      runId: 'run-1',
      canvasEventId: 'q-1',
    })
    expect(result.board.annotations.some((item) => item.id === 'q-1')).toBe(true)
  })

  it('lands a teach-answer as a teach annotation', () => {
    const board = createPressureTestBoard()
    const result = applyCanvasEvent(board, {
      schemaVersion: 1,
      id: 't-1',
      type: 'teach-answer',
      runId: 'run-1',
      frameId: 'frame-00',
      anchor: [0.2, 0.2],
      instruction: 'This is the primary navigation.',
      requestId: 'learn-9',
      createdAt: '2026-07-22T00:00:00.000Z',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.annotation).toMatchObject({
      role: 'teach',
      requestId: 'learn-9',
      instruction: 'This is the primary navigation.',
    })
  })

  it('rejects an unknown frame', () => {
    const board = createPressureTestBoard()
    const result = applyCanvasEvent(board, questionEvent({ frameId: 'ghost' }))
    expect(result).toEqual({ ok: false, reason: 'unknown-frame' })
  })

  it('dedupes by event id without changing the board', () => {
    const board = createPressureTestBoard()
    const first = applyCanvasEvent(board, questionEvent())
    expect(first.ok && first.applied).toBe(true)
    if (!first.ok) return
    const second = applyCanvasEvent(first.board, questionEvent())
    expect(second.ok && second.applied).toBe(false)
    if (!second.ok) return
    expect(second.board).toBe(first.board)
    expect(second.board.annotations.filter((item) => item.id === 'q-1')).toHaveLength(1)
  })
})
