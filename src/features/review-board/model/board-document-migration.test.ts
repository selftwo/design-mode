import { describe, expect, it } from 'vitest'
import { migrateBoardDocumentV1, parseBoardDocument, safeParseBoardDocument } from './board-document-migration'

const dataUrl = 'data:image/png;base64,iVBORw0KGgo='

function legacyFrame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'frame-1',
    label: 'Frame 1',
    route: '/one',
    viewport: { width: 1440, height: 900 },
    x: 0,
    y: 0,
    width: 420,
    height: 262.5,
    aspectRatio: 1.6,
    screenshotPath: 'screens/one.png',
    screenshotDataUrl: dataUrl,
    refreshedScreenshotDataUrl: dataUrl,
    captureHash: 'hash-1',
    revision: 1,
    elements: [],
    source: 'captured-route',
    ...overrides,
  }
}

function legacyBoard(frames: Record<string, unknown>[]): Record<string, unknown> {
  return {
    schemaVersion: 1,
    boardId: 'legacy-board',
    camera: { worldX: 0, worldY: 0, zoom: 1 },
    frames,
    annotations: [],
  }
}

describe('parseBoardDocument', () => {
  it('leaves a valid v2 board unchanged', () => {
    const v2 = migrateBoardDocumentV1(legacyBoard([legacyFrame()]) as never)
    expect(parseBoardDocument(v2)).toEqual(v2)
  })

  it('assigns documentRevision 1 when migrating from v1', () => {
    const board = parseBoardDocument(legacyBoard([legacyFrame()]))
    expect(board.documentRevision).toBe(1)
  })

  it('defaults documentRevision to 1 when missing on v2 JSON', () => {
    const v2 = migrateBoardDocumentV1(legacyBoard([legacyFrame()]) as never)
    const { documentRevision: _revision, ...withoutRevision } = v2
    expect(parseBoardDocument(withoutRevision).documentRevision).toBe(1)
  })

  it('rejects an unsupported schema version', () => {
    expect(() => parseBoardDocument({ schemaVersion: 3 })).toThrow(/Unsupported board schema version 3/)
    expect(safeParseBoardDocument({ schemaVersion: 3 }).success).toBe(false)
  })

  it('rejects a missing schema version', () => {
    expect(() => parseBoardDocument({ boardId: 'x' })).toThrow()
  })
})

describe('migrateBoardDocumentV1', () => {
  it('maps route, upload, and option frames to v2 kinds', () => {
    const board = parseBoardDocument(legacyBoard([
      legacyFrame({ id: 'route', source: 'captured-route' }),
      legacyFrame({ id: 'upload', source: 'captured-route', route: 'uploaded:hero.png' }),
      legacyFrame({ id: 'option', source: 'lofi-option', optionSetId: 'set-a' }),
    ]))
    expect(board.frames.map((frame) => frame.kind)).toEqual(['captured-route', 'imported-image', 'option-snapshot'])
    expect(board.frames.every((frame) => frame.lifeState === 'active')).toBe(true)
  })

  it('groups option frames by optionSetId and gives set-less options their own unit', () => {
    const board = parseBoardDocument(legacyBoard([
      legacyFrame({ id: 'a', source: 'lofi-option', optionSetId: 'set-a' }),
      legacyFrame({ id: 'b', source: 'lofi-option', optionSetId: 'set-a' }),
      legacyFrame({ id: 'c', source: 'lofi-option' }),
    ]))
    expect(board.units.map((unit) => unit.id)).toEqual(['set-a', 'legacy-unit-c'])
    expect(board.frames.map((frame) => frame.unitId)).toEqual(['set-a', 'set-a', 'legacy-unit-c'])
  })

  it('turns only the first preferred option in a set into the unit nominee, never a lock', () => {
    const board = parseBoardDocument(legacyBoard([
      legacyFrame({ id: 'a', source: 'lofi-option', optionSetId: 'set-a', preferred: true }),
      legacyFrame({ id: 'b', source: 'lofi-option', optionSetId: 'set-a', preferred: true }),
    ]))
    const unit = board.units[0]!
    expect(unit.nomineeFrameId).toBe('a')
    expect(unit.lockedFrameId).toBeUndefined()
    expect(unit.state).toBe('open')
    expect(board.verdicts).toHaveLength(0)
    expect(board.frames.every((frame) => frame.lifeState === 'active')).toBe(true)
  })

  it('adds empty zones and verdicts and preserves annotations', () => {
    const board = parseBoardDocument({
      ...legacyBoard([legacyFrame({ id: 'route' })]),
      annotations: [
        {
          id: 'note-1',
          frameId: 'route',
          status: 'draft',
          instruction: 'Tighten',
          anchor: [0.5, 0.5],
          mark: null,
          createdAt: '2026-07-16T10:00:00.000Z',
          madeAgainstCaptureHash: 'hash-1',
          madeAgainstRevision: 1,
        },
      ],
    })
    expect(board.zones).toEqual([])
    expect(board.verdicts).toEqual([])
    expect(board.annotations).toHaveLength(1)
  })
})
