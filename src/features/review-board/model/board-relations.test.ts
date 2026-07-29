import { describe, expect, it } from 'vitest'
import { BoardDocumentSchema, type BoardDocument } from './board-document.schema'

const dataUrl = 'data:image/png;base64,iVBORw0KGgo='

function optionFrameBase(id: string): BoardDocument['frames'][number] {
  return {
    id,
    label: id,
    route: `/scratch/proj/set/${id}.html`,
    viewport: { width: 1440, height: 900 },
    x: 0,
    y: 0,
    width: 420,
    height: 262.5,
    aspectRatio: 1.6,
    screenshotPath: `screens/${id}.png`,
    screenshotDataUrl: dataUrl,
    refreshedScreenshotDataUrl: dataUrl,
    captureHash: `${id}-hash`,
    revision: 1,
    elements: [],
    kind: 'option-snapshot',
    lifeState: 'active',
    unitId: 'unit-a',
  }
}

function validBoard(): BoardDocument {
  return {
    schemaVersion: 2,
    boardId: 'relations-board',
    documentRevision: 1,
    camera: { worldX: 0, worldY: 0, zoom: 1 },
    frames: [
      { ...optionFrameBase('opt-1'), kind: 'option-snapshot' },
      {
        ...optionFrameBase('opt-2'),
        kind: 'playable-option',
        liveSource: {
          kind: 'scratch-html',
          path: '/scratch/proj/set/option-2.html',
          protocolVersion: 1,
          artifactHash: 'a'.repeat(64),
        },
        kit: {
          manifest: {
            manifestVersion: 1,
            controls: [
              { kind: 'toggle', id: 'dense', label: 'Dense', default: false },
              {
                kind: 'choice',
                id: 'theme',
                label: 'Theme',
                options: [
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ],
                default: 'light',
              },
            ],
          },
          state: { dense: false, theme: 'light' },
        },
      },
    ],
    annotations: [],
    units: [
      { id: 'unit-a', label: 'Unit A', brief: '', rules: [], dependsOnUnitIds: [], state: 'open' },
    ],
    zones: [],
    verdicts: [],
    reviewSummaries: [],
  }
}

function mutate(change: (board: BoardDocument) => void): ReturnType<typeof BoardDocumentSchema.safeParse> {
  const board = structuredClone(validBoard())
  change(board)
  return BoardDocumentSchema.safeParse(board)
}

function firstPath(result: ReturnType<typeof BoardDocumentSchema.safeParse>): string {
  if (result.success) return ''
  return result.error.issues.map((issue) => issue.path.join('.')).join(' | ')
}

describe('board relations', () => {
  it('accepts a valid board', () => {
    expect(BoardDocumentSchema.safeParse(validBoard()).success).toBe(true)
  })

  it('rejects duplicate frame ids', () => {
    const result = mutate((board) => {
      board.frames[1] = { ...board.frames[1]!, id: 'opt-1' }
    })
    expect(result.success).toBe(false)
    expect(firstPath(result)).toContain('frames.1.id')
  })

  it('rejects an annotation that names a missing frame', () => {
    const result = mutate((board) => {
      board.annotations.push({
        id: 'note',
        frameId: 'ghost',
        role: 'review',
        status: 'draft',
        instruction: '',
        anchor: [0.5, 0.5],
        mark: null,
        createdAt: '2026-07-16T10:00:00.000Z',
        madeAgainstCaptureHash: 'x',
        madeAgainstRevision: 1,
      })
    })
    expect(firstPath(result)).toContain('annotations.0.frameId')
  })

  it('rejects a frame that names a missing unit', () => {
    const result = mutate((board) => {
      board.frames[0] = { ...board.frames[0]!, unitId: 'ghost' }
    })
    expect(firstPath(result)).toContain('frames.0.unitId')
  })

  it('rejects a playable option without a live source or kit', () => {
    const result = mutate((board) => {
      board.frames[1] = { ...board.frames[1]!, liveSource: undefined, kit: undefined }
    })
    expect(result.success).toBe(false)
  })

  it('rejects a snapshot that carries a kit', () => {
    const result = mutate((board) => {
      board.frames[0] = { ...board.frames[1]!, id: 'opt-1', kind: 'option-snapshot' }
    })
    expect(firstPath(result)).toContain('frames.0')
  })

  it('rejects a kit whose choice default is not one of its options', () => {
    const result = mutate((board) => {
      const kit = board.frames[1]!.kit!
      kit.manifest.controls[1] = { ...kit.manifest.controls[1]!, default: 'missing' } as never
    })
    expect(result.success).toBe(false)
  })

  it('rejects kit state with the wrong value type', () => {
    const result = mutate((board) => {
      board.frames[1]!.kit!.state = { dense: 'nope', theme: 'light' } as never
    })
    expect(firstPath(result)).toContain('frames.1.kit.state')
  })

  it('rejects kit state naming an unknown control', () => {
    const result = mutate((board) => {
      board.frames[1]!.kit!.state = { dense: false, theme: 'light', extra: true } as never
    })
    expect(firstPath(result)).toContain('frames.1.kit.state.extra')
  })

  it('rejects a self dependency', () => {
    const result = mutate((board) => {
      board.units[0]!.dependsOnUnitIds = ['unit-a']
    })
    expect(firstPath(result)).toContain('units.0.dependsOnUnitIds')
  })

  it('rejects a missing dependency', () => {
    const result = mutate((board) => {
      board.units[0]!.dependsOnUnitIds = ['ghost']
    })
    expect(firstPath(result)).toContain('units.0.dependsOnUnitIds')
  })

  it('rejects a dependency cycle', () => {
    const result = mutate((board) => {
      board.units.push({ id: 'unit-b', label: 'B', brief: '', rules: [], dependsOnUnitIds: ['unit-a'], state: 'open' })
      board.units[0]!.dependsOnUnitIds = ['unit-b']
    })
    expect(firstPath(result)).toContain('units')
  })

  it('rejects a nominee that is not an active option in the unit', () => {
    const result = mutate((board) => {
      board.units[0]!.nomineeFrameId = 'ghost'
    })
    expect(firstPath(result)).toContain('units.0.nomineeFrameId')
  })

  it('rejects an archived unit option that has no zone', () => {
    const result = mutate((board) => {
      board.frames[1] = { ...board.frames[1]!, lifeState: 'archived' }
    })
    expect(result.success).toBe(false)
    expect(firstPath(result)).toContain('frames.1.zoneId')
  })

  it('rejects a zone that names a unit different from its frame', () => {
    const result = mutate((board) => {
      board.units.push({ id: 'unit-b', label: 'B', brief: '', rules: [], dependsOnUnitIds: [], state: 'open' })
      board.zones.push({ id: 'zone-1', unitId: 'unit-b', kind: 'archive', label: 'Archive', x: 0, y: 0, width: 10, height: 10, collapsed: false })
      board.frames[0] = { ...board.frames[0]!, lifeState: 'archived', zoneId: 'zone-1' }
    })
    expect(result.success).toBe(false)
  })

  it('rejects a verdict that does not match the unit lock', () => {
    const result = mutate((board) => {
      board.verdicts.push({
        id: 'v-1',
        unitId: 'unit-a',
        frameId: 'opt-1',
        kind: 'promote',
        summary: 'Winner',
        createdAt: '2026-07-16T10:00:00.000Z',
        kitSnapshot: null,
        referenceFrameIds: [],
      })
    })
    expect(result.success).toBe(false)
  })

  it('accepts a fully locked unit with a promote verdict and archived loser', () => {
    const board = structuredClone(validBoard())
    board.units[0] = { ...board.units[0]!, state: 'locked', lockedFrameId: 'opt-1' }
    board.frames[0] = { ...board.frames[0]!, lifeState: 'locked' }
    board.frames[1] = { ...board.frames[1]!, lifeState: 'archived', zoneId: 'zone-arch' }
    board.zones.push({ id: 'zone-arch', unitId: 'unit-a', kind: 'archive', label: 'Archive', x: 0, y: 0, width: 10, height: 10, collapsed: false })
    board.verdicts.push({
      id: 'v-1',
      unitId: 'unit-a',
      frameId: 'opt-1',
      kind: 'promote',
      summary: 'Winner',
      createdAt: '2026-07-16T10:00:00.000Z',
      kitSnapshot: null,
      referenceFrameIds: [],
    })
    expect(BoardDocumentSchema.safeParse(board).success).toBe(true)
  })

  it('rejects a kill verdict that names a frame that is not killed', () => {
    const result = mutate((board) => {
      board.verdicts.push({
        id: 'kill-1',
        unitId: 'unit-a',
        frameId: 'opt-1',
        kind: 'kill',
        summary: 'gone',
        createdAt: '2026-07-16T10:00:00.000Z',
        kitSnapshot: null,
        referenceFrameIds: [],
      })
    })
    expect(result.success).toBe(false)
    expect(firstPath(result)).toContain('verdicts.0.frameId')
  })

  it('rejects a killed frame without a matching kill verdict', () => {
    const result = mutate((board) => {
      board.zones.push({ id: 'zone-kill', unitId: 'unit-a', kind: 'killed', label: 'Killed', x: 0, y: 300, width: 400, height: 180, collapsed: false })
      board.frames[0] = { ...board.frames[0]!, lifeState: 'killed', zoneId: 'zone-kill' }
    })
    expect(result.success).toBe(false)
    expect(firstPath(result)).toContain('frames.0.lifeState')
  })

  it('rejects a second verdict on the same frame', () => {
    const result = mutate((board) => {
      board.zones.push({ id: 'zone-kill', unitId: 'unit-a', kind: 'killed', label: 'Killed', x: 0, y: 300, width: 400, height: 180, collapsed: false })
      board.frames[0] = { ...board.frames[0]!, lifeState: 'killed', zoneId: 'zone-kill' }
      const kill = {
        unitId: 'unit-a',
        frameId: 'opt-1',
        kind: 'kill' as const,
        summary: 'gone',
        createdAt: '2026-07-16T10:00:00.000Z',
        kitSnapshot: null,
        referenceFrameIds: [],
      }
      board.verdicts.push({ ...kill, id: 'kill-1' })
      board.verdicts.push({ ...kill, id: 'kill-2' })
    })
    expect(result.success).toBe(false)
    expect(firstPath(result)).toContain('verdicts.1.frameId')
  })

  it('rejects a promote verdict on an open unit', () => {
    const result = mutate((board) => {
      board.verdicts.push({
        id: 'promote-1',
        unitId: 'unit-a',
        frameId: 'opt-1',
        kind: 'promote',
        summary: 'winner',
        createdAt: '2026-07-16T10:00:00.000Z',
        kitSnapshot: null,
        referenceFrameIds: [],
      })
    })
    expect(result.success).toBe(false)
    expect(firstPath(result)).toContain('units.0.state')
  })

  it('rejects a non-option frame that left the active life state', () => {
    const archivedRoute = mutate((board) => {
      board.frames.push({ ...optionFrameBase('shot'), kind: 'captured-route', unitId: undefined, lifeState: 'archived' })
    })
    expect(archivedRoute.success).toBe(false)
    expect(firstPath(archivedRoute)).toContain('frames.2.lifeState')

    const killedUpload = mutate((board) => {
      board.frames.push({ ...optionFrameBase('upload'), kind: 'imported-image', unitId: undefined, lifeState: 'killed' })
    })
    expect(killedUpload.success).toBe(false)
    expect(firstPath(killedUpload)).toContain('frames.2.lifeState')
  })

  it('rejects two review summaries for the same frame', () => {
    const result = mutate((board) => {
      board.reviewSummaries.push({ frameId: 'opt-1', visibleSeconds: 3, kitStatesTried: 1, playedLive: false })
      board.reviewSummaries.push({ frameId: 'opt-1', visibleSeconds: 4, kitStatesTried: 0, playedLive: true })
    })
    expect(firstPath(result)).toContain('reviewSummaries.1.frameId')
  })

  it('tolerates a review summary for a frame no longer on the board', () => {
    const result = mutate((board) => {
      board.reviewSummaries.push({ frameId: 'ghost', visibleSeconds: 3, kitStatesTried: 0, playedLive: false })
    })
    expect(result.success).toBe(true)
  })
})
