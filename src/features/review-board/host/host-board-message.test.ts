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

  it('rejects an unsupported host envelope version', () => {
    const board = createPressureTestBoard()
    expect(readHostBoardLoadMessage(loadMessage(board, 2))).toEqual({
      status: 'rejected',
      error: 'Unsupported host message version 2. This app supports version 1.',
    })
  })

  it('migrates a v1 board and rejects an unsupported board version', () => {
    const board = createPressureTestBoard()
    const legacyFrame = {
      ...board.frames[0]!,
      source: 'lofi-option',
      optionSetId: 'set-a',
      preferred: true,
    }
    const legacyBoard = {
      schemaVersion: 1,
      boardId: 'legacy-board',
      camera: board.camera,
      frames: [legacyFrame],
      annotations: [],
    }
    const result = readHostBoardLoadMessage(loadMessage(legacyBoard))
    expect(result.status).toBe('loaded')
    if (result.status === 'loaded') {
      expect(result.board.schemaVersion).toBe(2)
      expect(result.board.frames[0]!.kind).toBe('option-snapshot')
      expect(result.board.units[0]!.id).toBe('set-a')
      expect(result.board.units[0]!.nomineeFrameId).toBe(legacyFrame.id)
    }

    expect(readHostBoardLoadMessage(loadMessage({ ...board, schemaVersion: 3 }))).toEqual({
      status: 'rejected',
      error: 'Unsupported board schema version 3. This app supports version 2.',
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
