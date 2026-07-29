import { describe, expect, it } from 'vitest'
import { createPressureTestBoard } from '@/test-support/create-pressure-test-board'
import { mergeBoardPatch } from './merge-board-patch'
import type { ReviewAnnotation } from './board-document.schema'

function agentQuestion(): ReviewAnnotation {
  return {
    id: 'q-1',
    frameId: 'frame-00',
    role: 'agent-question',
    status: 'draft',
    instruction: 'What is this?',
    anchor: [0.5, 0.5],
    mark: null,
    createdAt: '2026-07-22T00:00:00.000Z',
    madeAgainstCaptureHash: 'hash',
    madeAgainstRevision: 1,
    runId: 'run-1',
    canvasEventId: 'q-1',
  }
}

describe('mergeBoardPatch', () => {
  it('upserts agent annotations and advances documentRevision', () => {
    const board = createPressureTestBoard()
    const dirty = {
      ...board,
      annotations: board.annotations.map((item, index) => index === 0
        ? { ...item, instruction: 'Local edit still drafting' }
        : item),
    }
    const patched = mergeBoardPatch(dirty, {
      documentRevision: 9,
      records: [{ kind: 'annotation', annotation: agentQuestion() }],
    })
    expect(patched.documentRevision).toBe(9)
    expect(patched.annotations.find((item) => item.id === 'q-1')?.role).toBe('agent-question')
    expect(patched.annotations[0]?.instruction).toBe('Local edit still drafting')
  })

  it('ignores review-role records so a patch cannot clobber human notes', () => {
    const board = createPressureTestBoard()
    const review: ReviewAnnotation = {
      ...board.annotations[0]!,
      id: 'spoof',
      role: 'review',
      instruction: 'Should not land via patch',
    }
    const patched = mergeBoardPatch(board, {
      documentRevision: board.documentRevision + 1,
      records: [{ kind: 'annotation', annotation: review }],
    })
    expect(patched.annotations.find((item) => item.id === 'spoof')).toBeUndefined()
  })

  it('drops a record on a frame this client has not loaded yet', () => {
    const board = createPressureTestBoard()
    const onUnknownFrame = { ...agentQuestion(), frameId: 'frame-from-a-newer-board' }
    const patched = mergeBoardPatch(board, {
      documentRevision: board.documentRevision + 1,
      records: [{ kind: 'annotation', annotation: onUnknownFrame }],
    })
    expect(patched.annotations.find((item) => item.id === 'q-1')).toBeUndefined()
    // The revision still advances so the client does not re-request the patch.
    expect(patched.documentRevision).toBe(board.documentRevision + 1)
  })

  it('returns the same document object for a no-op patch', () => {
    const board = createPressureTestBoard()
    const patched = mergeBoardPatch(board, { documentRevision: board.documentRevision, records: [] })
    expect(patched).toBe(board)
  })

  it('never lowers documentRevision when the patch is older', () => {
    const board = { ...createPressureTestBoard(), documentRevision: 12 }
    const patched = mergeBoardPatch(board, {
      documentRevision: 3,
      records: [{ kind: 'annotation', annotation: agentQuestion() }],
    })
    expect(patched.documentRevision).toBe(12)
  })

  it('updates an existing agent annotation in place', () => {
    const board = {
      ...createPressureTestBoard(),
      annotations: [...createPressureTestBoard().annotations, agentQuestion()],
    }
    const updated = { ...agentQuestion(), instruction: 'Updated question text' }
    const patched = mergeBoardPatch(board, {
      documentRevision: 4,
      records: [{ kind: 'annotation', annotation: updated }],
    })
    expect(patched.annotations.find((item) => item.id === 'q-1')?.instruction).toBe('Updated question text')
  })
})
