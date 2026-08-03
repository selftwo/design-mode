import { describe, expect, it } from 'vitest'
import { createMWebTestBoard } from '@/test-support/create-m-web-test-board'
import { isAnnotationResolved } from './is-annotation-resolved'
import { resolveBoardAnnotation } from './resolve-board-annotation'

describe('resolveBoardAnnotation', () => {
  it('sets resolvedAt on the target annotation and leaves others untouched', () => {
    const board = createMWebTestBoard()
    const annotationId = board.annotations[0]!.id
    const resolved = resolveBoardAnnotation(board, annotationId)
    expect(isAnnotationResolved(resolved.annotations[0]!)).toBe(true)
    expect(resolved.annotations[0]?.resolvedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('is a no-op when the annotation id is missing', () => {
    const board = createMWebTestBoard()
    expect(resolveBoardAnnotation(board, 'missing')).toEqual(board)
  })
})
