import { describe, expect, it } from 'vitest'
import { createPressureTestBoard } from '@/test-support/create-pressure-test-board'
import { appendThreadReply } from './append-thread-reply'

describe('appendThreadReply', () => {
  it('appends a reply on the matching review annotation', () => {
    const board = createPressureTestBoard()
    const annotationId = board.annotations[0]!.id
    const next = appendThreadReply(board, annotationId, '  From mobile  ', 'Ben')
    const annotation = next.annotations.find((item) => item.id === annotationId)
    expect(annotation && 'replies' in annotation && annotation.replies).toHaveLength(1)
    expect(annotation && 'replies' in annotation && annotation.replies?.[0]).toMatchObject({
      body: 'From mobile',
      author: 'Ben',
    })
  })

  it('ignores blank replies', () => {
    const board = createPressureTestBoard()
    const annotationId = board.annotations[0]!.id
    const next = appendThreadReply(board, annotationId, '   ')
    expect(next).toBe(board)
  })
})
