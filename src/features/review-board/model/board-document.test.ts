import { describe, expect, it } from 'vitest'
import { createPressureTestBoard } from '@/test-support/create-pressure-test-board'
import { normalizeLocalPoint, projectNormalizedPoint, resizeFrameAspectLocked } from './board-geometry'
import { deserializeBoard, serializeBoard } from './board-local-storage'
import { exportAgentAnnotation } from './export-agent-annotation'

describe('canonical board model', () => {
  it('creates a mixed 50 screen fixture with stress annotations', () => {
    const board = createPressureTestBoard()
    expect(board.frames).toHaveLength(50)
    expect(board.frames.filter((frame) => frame.viewport.width === 2560)).toHaveLength(2)
    expect(new Set(board.frames.map((frame) => frame.aspectRatio)).size).toBe(3)
    expect(board.annotations.filter((item) => item.frameId === 'frame-00').length).toBeGreaterThanOrEqual(20)
  })

  it('keeps normalized anchors stable across frame move and aspect resize', () => {
    const frame = createPressureTestBoard().frames[7]
    expect(frame).toBeDefined()
    const anchor = normalizeLocalPoint([120, 80], frame!.width, frame!.height)
    const before = projectNormalizedPoint(frame!, anchor)
    const resized = resizeFrameAspectLocked({ ...frame!, x: frame!.x + 90, y: frame!.y + 40 }, frame!.width * 1.25)
    const after = projectNormalizedPoint(resized, anchor)
    expect(resized.height).toBeCloseTo(resized.width / resized.aspectRatio)
    expect(after.x - resized.x).toBeCloseTo(anchor[0] * resized.width)
    expect(after.y - resized.y).toBeCloseTo(anchor[1] * resized.height)
    expect(before.x).not.toBe(after.x)
  })

  it('round trips the semantic board and rejects unknown schema versions', () => {
    const board = createPressureTestBoard()
    expect(deserializeBoard(serializeBoard(board))).toEqual(board)
    expect(() => deserializeBoard('{"schemaVersion":3,"frames":[],"annotations":[]}')).toThrow()
  })

  it('accepts valid boards without imposing the pressure test frame count', () => {
    const board = createPressureTestBoard()
    const oneFrameBoard = { ...board, frames: board.frames.slice(0, 1), annotations: [] }
    expect(deserializeBoard(serializeBoard(oneFrameBoard)).frames).toHaveLength(1)
  })

  it('exports an architecture compatible agent neutral record', () => {
    const board = createPressureTestBoard()
    const originalHash = board.annotations[0]!.madeAgainstCaptureHash
    const record = exportAgentAnnotation({
      ...board,
      frames: board.frames.map((frame) => frame.id === 'frame-00'
        ? { ...frame, captureHash: 'newer-capture', revision: 2 }
        : frame),
    }, 'annotation-0')
    expect(record).toMatchObject({
      schemaVersion: 1,
      id: 'annotation-0',
      status: 'draft',
      frameId: 'frame-00',
      route: '/fixture/0',
      crop: null,
      elements: [],
    })
    expect(record.fullScreenshot).not.toMatch(/^\//)
    expect(record.marks).toHaveLength(1)
    expect(record.madeAgainst.captureHash).toBe(originalHash)
    expect(record.madeAgainst.revision).toBe(1)
  })

  it('accepts legacy review annotations without an explicit kind field', () => {
    const board = createPressureTestBoard()
    const legacy = {
      ...board,
      annotations: [{
        id: 'legacy-ann',
        frameId: board.frames[0]!.id,
        status: 'draft',
        instruction: 'Legacy note',
        anchor: [0.5, 0.5],
        mark: null,
        createdAt: '2026-07-13T00:00:00.000Z',
        madeAgainstCaptureHash: board.frames[0]!.captureHash,
        madeAgainstRevision: board.frames[0]!.revision,
      }],
    }
    const restored = deserializeBoard(JSON.stringify(legacy))
    expect(restored.annotations[0]?.kind).toBe('review')
  })

  it('rejects annotations with out of range anchors', () => {
    const board = createPressureTestBoard()
    const invalid = { ...board, annotations: [{ ...board.annotations[0]!, anchor: [2, 0.5] }] }
    expect(() => deserializeBoard(JSON.stringify(invalid))).toThrow()
  })
})
