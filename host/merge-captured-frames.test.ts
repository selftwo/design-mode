import { describe, expect, it } from 'vitest'
import { BoardDocumentSchema, type BoardDocument, type ScreenFrame } from '../src/features/review-board/model/board-document.schema.ts'
import { mergeCapturedFrames } from './merge-captured-frames.ts'

const dataUrl = 'data:image/png;base64,iVBORw0KGgo='

function capturedFrame(id: string, captureHash: string): ScreenFrame {
  return {
    id,
    label: `Screen ${id}`,
    route: `/${id}`,
    viewport: { width: 1440, height: 900 },
    x: 0,
    y: 0,
    width: 420,
    height: 262.5,
    aspectRatio: 1.6,
    screenshotPath: `screens/${id}.png`,
    screenshotDataUrl: dataUrl,
    refreshedScreenshotDataUrl: dataUrl,
    captureHash,
    revision: 1,
    elements: [],
  }
}

function existingBoard(): BoardDocument {
  const frame = { ...capturedFrame('home', 'hash-v1'), x: 300, y: 120, width: 600, height: 375, label: 'Home, arranged' }
  return {
    schemaVersion: 1,
    boardId: 'existing-board',
    camera: { worldX: 10, worldY: 20, zoom: 1.4 },
    frames: [frame],
    annotations: [
      {
        id: 'note-1',
        frameId: 'home',
        status: 'draft',
        instruction: 'Tighten the hero spacing',
        anchor: [0.4, 0.3],
        mark: null,
        createdAt: '2026-07-16T10:00:00.000Z',
        madeAgainstCaptureHash: 'hash-v1',
        madeAgainstRevision: 1,
      },
    ],
  }
}

describe('mergeCapturedFrames', () => {
  it('lays out a first capture in a row and validates', () => {
    const board = mergeCapturedFrames(null, [capturedFrame('a', 'h1'), capturedFrame('b', 'h2')], 'fresh-board')
    expect(board.boardId).toBe('fresh-board')
    expect(board.frames[1]!.x).toBeGreaterThanOrEqual(board.frames[0]!.x + board.frames[0]!.width)
    expect(() => BoardDocumentSchema.parse(board)).not.toThrow()
  })

  it('keeps layout, annotations, and camera while advancing changed captures', () => {
    const board = mergeCapturedFrames(existingBoard(), [capturedFrame('home', 'hash-v2')], 'ignored')
    const frame = board.frames[0]!
    expect(frame.x).toBe(300)
    expect(frame.width).toBe(600)
    expect(frame.label).toBe('Home, arranged')
    expect(frame.captureHash).toBe('hash-v2')
    expect(frame.revision).toBe(2)
    expect(board.camera).toEqual({ worldX: 10, worldY: 20, zoom: 1.4 })
    expect(board.annotations).toHaveLength(1)
  })

  it('does not bump the revision when the capture pixels are identical', () => {
    const board = mergeCapturedFrames(existingBoard(), [capturedFrame('home', 'hash-v1')], 'ignored')
    expect(board.frames[0]!.revision).toBe(1)
    expect(board.frames[0]!.label).toBe('Home, arranged')
  })

  it('appends screens that did not exist before to the right of the board', () => {
    const board = mergeCapturedFrames(existingBoard(), [capturedFrame('pricing', 'h3')], 'ignored')
    expect(board.frames).toHaveLength(2)
    expect(board.frames[1]!.x).toBeGreaterThanOrEqual(900)
  })
})
