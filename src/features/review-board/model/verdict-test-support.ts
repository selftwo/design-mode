import { BoardDocumentSchema, type BoardDocument, type FrameLifeState, type ScreenFrame, type UnitVerdict } from './board-document.schema'
import { ensureZonesForUnit } from './ensure-zones-for-unit'

const DATA_URL = 'data:image/svg+xml;base64,PHN2Zy8+'

// A live playable option owned by the shared test unit, with a single toggle
// kit so verdict snapshots have something to carry.
function optionFrame(id: string, index: number, lifeState: FrameLifeState): ScreenFrame {
  return {
    id,
    label: `Option ${id}`,
    route: `/scratch/proj/set/option-${index}.html`,
    viewport: { width: 1440, height: 900 },
    x: index * 260,
    y: 0,
    width: 220,
    height: 137.5,
    aspectRatio: 1.6,
    screenshotPath: `screens/${id}.png`,
    screenshotDataUrl: DATA_URL,
    refreshedScreenshotDataUrl: DATA_URL,
    captureHash: `${id}-hash`,
    revision: 1,
    elements: [],
    kind: 'playable-option',
    lifeState,
    unitId: 'unit',
    liveSource: {
      kind: 'scratch-html',
      path: `/scratch/proj/set/option-${index}.html`,
      protocolVersion: 1,
      artifactHash: 'a'.repeat(64),
    },
    kit: {
      manifest: { manifestVersion: 1, controls: [{ kind: 'toggle', id: 'expand', label: 'Expanded', default: false }] },
      state: { expand: false },
    },
  }
}

// A board with one unit that owns the given option frames. Options are active by
// default; overrides let a test lock the unit or start a frame archived so the
// verdict gates can be exercised. The result is schema-validated, so it is a
// valid starting point for applyUnitVerdict.
export function optionBoard(
  frameIds: string[],
  overrides: {
    unitState?: 'open' | 'locked'
    lockedFrameId?: string
    lockedLifeState?: FrameLifeState
    firstFrameLifeState?: FrameLifeState
    nomineeFrameId?: string
  } = {},
): BoardDocument {
  // Build life states first, but keep frames active for the initial parse so the
  // relation rules that require zoneIds on archived/killed frames do not fire
  // before zones exist.
  const intended = new Map<string, FrameLifeState>()
  const frames = frameIds.map((id, index) => {
    let lifeState: FrameLifeState = 'active'
    if (index === 0 && overrides.firstFrameLifeState) lifeState = overrides.firstFrameLifeState
    if (overrides.lockedFrameId === id && overrides.lockedLifeState) lifeState = overrides.lockedLifeState
    intended.set(id, lifeState)
    return optionFrame(id, index + 1, 'active')
  })
  const state = overrides.unitState ?? 'open'
  const verdicts: UnitVerdict[] = []
  if (state === 'locked' && overrides.lockedFrameId) {
    verdicts.push({
      id: 'seed-verdict',
      unitId: 'unit',
      frameId: overrides.lockedFrameId,
      kind: 'promote',
      summary: 'seeded lock',
      createdAt: new Date('2026-07-22T00:00:00.000Z').toISOString(),
      kitSnapshot: { expand: false },
      referenceFrameIds: [],
    })
  }

  const activeBoard = BoardDocumentSchema.parse({
    schemaVersion: 2,
    boardId: 'verdict-board',
    documentRevision: 1,
    camera: { worldX: 0, worldY: 0, zoom: 1 },
    frames,
    annotations: [],
    units: [{
      id: 'unit',
      label: 'Unit',
      brief: 'Pick one',
      rules: [],
      dependsOnUnitIds: [],
      state: 'open',
      nomineeFrameId: overrides.nomineeFrameId,
    }],
    zones: [],
    verdicts: [],
  })
  const withZones = ensureZonesForUnit(activeBoard, 'unit')
  const archiveId = withZones.zones.find((zone) => zone.kind === 'archive')!.id
  const killedId = withZones.zones.find((zone) => zone.kind === 'killed')!.id

  for (const [id, lifeState] of intended) {
    if (lifeState !== 'killed') continue
    verdicts.push({
      id: `seed-kill-${id}`,
      unitId: 'unit',
      frameId: id,
      kind: 'kill',
      summary: 'seeded kill',
      createdAt: new Date('2026-07-22T00:00:00.000Z').toISOString(),
      kitSnapshot: { expand: false },
      referenceFrameIds: [],
    })
  }

  return BoardDocumentSchema.parse({
    ...withZones,
    units: [{
      id: 'unit',
      label: 'Unit',
      brief: 'Pick one',
      rules: [],
      dependsOnUnitIds: [],
      state,
      nomineeFrameId: overrides.nomineeFrameId,
      lockedFrameId: state === 'locked' ? overrides.lockedFrameId : undefined,
    }],
    frames: withZones.frames.map((frame) => {
      const lifeState = intended.get(frame.id) ?? 'active'
      if (lifeState === 'archived') return { ...frame, lifeState, zoneId: archiveId }
      if (lifeState === 'killed') return { ...frame, lifeState, zoneId: killedId }
      if (lifeState === 'locked') return { ...frame, lifeState }
      return frame
    }),
    verdicts,
  })
}
