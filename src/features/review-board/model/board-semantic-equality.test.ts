import { describe, expect, it } from 'vitest'
import { createPressureTestBoard } from '@/test-support/create-pressure-test-board'
import { boardsSemanticallyEqual } from './board-semantic-equality'

describe('boardsSemanticallyEqual', () => {
  it('treats equivalent semantic boards as equal', () => {
    const board = createPressureTestBoard()
    expect(boardsSemanticallyEqual(board, { ...board })).toBe(true)
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