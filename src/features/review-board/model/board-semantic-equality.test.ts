import { describe, expect, it } from 'vitest'
import { createPressureTestBoard } from '@/test-support/create-pressure-test-board'
import { boardsSemanticallyEqual } from './board-semantic-equality'

describe('boardsSemanticallyEqual', () => {
  it('treats equivalent semantic boards as equal', () => {
    const board = createPressureTestBoard()
    expect(boardsSemanticallyEqual(board, { ...board })).toBe(true)
  })

  it('ignores documentRevision differences', () => {
    const board = createPressureTestBoard()
    expect(boardsSemanticallyEqual(board, { ...board, documentRevision: board.documentRevision + 1 })).toBe(true)
  })

  it('ignores review summary differences so telemetry never dirties the board', () => {
    const board = createPressureTestBoard()
    const withDwell = {
      ...board,
      reviewSummaries: [{ frameId: board.frames[0]!.id, visibleSeconds: 12, kitStatesTried: 2, playedLive: true }],
    }
    expect(boardsSemanticallyEqual(board, withDwell)).toBe(true)
  })

  it('does not throw on a board that fails schema validation', () => {
    const board = createPressureTestBoard()
    const invalid = {
      ...board,
      annotations: [{ ...board.annotations[0]!, frameId: 'missing-frame' }, ...board.annotations.slice(1)],
    }
    expect(() => boardsSemanticallyEqual(invalid, board)).not.toThrow()
    expect(boardsSemanticallyEqual(invalid, board)).toBe(false)
  })

  it('detects semantic camera changes', () => {
    const board = createPressureTestBoard()
    const changed = { ...board, camera: { ...board.camera, zoom: board.camera.zoom + 0.1 } }
    expect(boardsSemanticallyEqual(board, changed)).toBe(false)
  })

  it('detects annotation instruction changes', () => {
    const board = createPressureTestBoard()
    const changed = {
      ...board,
      annotations: board.annotations.map((item, index) => index === 0
        ? { ...item, instruction: 'updated copy' }
        : item),
    }
    expect(boardsSemanticallyEqual(board, changed)).toBe(false)
  })
})