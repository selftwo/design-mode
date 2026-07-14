import { describe, expect, it } from 'vitest'
import { createPressureTestBoard } from '@/test-support/create-pressure-test-board'
import { readHostBoardLoadMessage } from './host-board-message.schema'

function loadMessage(board: unknown, schemaVersion: unknown = 1) {
  return { type: 'design-review/load-board', schemaVersion, board }
}

describe('host board load message', () => {
  it('loads a validated board without changing its semantic data', () => {
    const board = createPressureTestBoard()
    expect(readHostBoardLoadMessage(loadMessage(board))).toEqual({ status: 'loaded', board })
  })

  it('rejects unsupported host and board schema versions with distinct errors', () => {
    const board = createPressureTestBoard()
    expect(readHostBoardLoadMessage(loadMessage(board, 2))).toEqual({
      status: 'rejected',
      error: 'Unsupported host message version 2. This app supports version 1.',
    })
    expect(readHostBoardLoadMessage(loadMessage({ ...board, schemaVersion: 2 }))).toEqual({
      status: 'rejected',
      error: 'Unsupported board schema version 2. This app supports version 1.',
    })
  })

  it('rejects invalid board data and ignores unrelated messages', () => {
    const board = createPressureTestBoard()
    const invalid = { ...board, frames: [{ ...board.frames[0], width: -1 }] }
    expect(readHostBoardLoadMessage(loadMessage(invalid))).toMatchObject({
      status: 'rejected',
      error: expect.stringContaining('Invalid board data: frames.0.width'),
    })
    expect(readHostBoardLoadMessage({ type: 'another/message' })).toEqual({ status: 'ignored' })
  })
})
