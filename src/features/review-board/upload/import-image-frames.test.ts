import { describe, expect, it } from 'vitest'
import { BoardDocumentSchema, BOARD_SCHEMA_VERSION, type BoardDocument } from '../model/board-document.schema'
import { buildUploadFrames, listImportableImageFiles } from './import-image-frames'

const dataUrl = 'data:image/png;base64,iVBORw0KGgo='

function boardWith(frames: BoardDocument['frames']): BoardDocument {
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    boardId: 'upload-board',
    documentRevision: 1,
    camera: { worldX: 0, worldY: 0, zoom: 1 },
    frames,
    annotations: [],
    units: [],
    zones: [],
    verdicts: [],
    reviewSummaries: [],
  }
}

function frameAt(x: number, width: number): BoardDocument['frames'][number] {
  return {
    id: `frame-${x}`,
    label: 'Frame',
    route: '/fixture',
    viewport: { width: 1440, height: 900 },
    x,
    y: 40,
    width,
    height: width / 1.6,
    aspectRatio: 1.6,
    screenshotPath: 'screens/frame.png',
    screenshotDataUrl: dataUrl,
    refreshedScreenshotDataUrl: dataUrl,
    captureHash: 'hash',
    revision: 1,
    elements: [],
    kind: 'captured-route',
    lifeState: 'active',
  }
}

describe('listImportableImageFiles', () => {
  it('keeps raster images and drops everything else', () => {
    const files = [
      new File(['a'], 'mock.png', { type: 'image/png' }),
      new File(['b'], 'photo.jpg', { type: 'image/jpeg' }),
      new File(['c'], 'notes.txt', { type: 'text/plain' }),
      new File(['d'], 'vector.svg', { type: 'image/svg+xml' }),
    ]
    expect(listImportableImageFiles(files).map((file) => file.name)).toEqual(['mock.png', 'photo.jpg'])
  })
})

describe('buildUploadFrames', () => {
  it('creates schema-valid frames that keep the image aspect ratio', () => {
    const board = boardWith([])
    const frames = buildUploadFrames(board, [
      { name: 'hero-mock.png', dataUrl, width: 1200, height: 800 },
    ], { now: 1700000000000 })
    expect(frames).toHaveLength(1)
    const frame = frames[0]!
    expect(frame.label).toBe('hero-mock')
    expect(frame.route).toBe('uploaded:hero-mock.png')
    expect(frame.aspectRatio).toBeCloseTo(1.5)
    expect(frame.height).toBeCloseTo(frame.width / 1.5)
    expect(frame.kind).toBe('imported-image')
    expect(frame.unitId).toBeUndefined()
    expect(() => BoardDocumentSchema.parse({ ...board, frames })).not.toThrow()
  })

  it('links a drop to the active unit as a reference image', () => {
    const board: BoardDocument = {
      ...boardWith([]),
      units: [{ id: 'unit-1', label: 'Nav', brief: 'Pick a nav', rules: [], dependsOnUnitIds: [], state: 'open' }],
    }
    const frames = buildUploadFrames(board, [
      { name: 'inspo.png', dataUrl, width: 800, height: 600 },
    ], { unitId: 'unit-1', now: 1700000000000 })
    const frame = frames[0]!
    expect(frame.kind).toBe('reference-image')
    expect(frame.unitId).toBe('unit-1')
    expect(() => BoardDocumentSchema.parse({ ...board, frames })).not.toThrow()
  })

  it('places uploads to the right of existing frames without overlap', () => {
    const board = boardWith([frameAt(0, 400), frameAt(600, 400)])
    const frames = buildUploadFrames(board, [
      { name: 'a.png', dataUrl, width: 1000, height: 500 },
      { name: 'b.png', dataUrl, width: 1000, height: 1000 },
    ])
    expect(frames[0]!.x).toBeGreaterThanOrEqual(1000 + 80)
    expect(frames[1]!.x).toBeGreaterThan(frames[0]!.x + frames[0]!.width)
    expect(new Set(frames.map((frame) => frame.id)).size).toBe(2)
  })
})
