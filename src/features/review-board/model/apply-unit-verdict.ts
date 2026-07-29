import {
  BoardDocumentSchema,
  type BoardDocument,
  type BoardZone,
  type KitStateValue,
  type ScreenFrame,
  type UnitVerdict,
} from './board-document.schema'
import { isOptionFrame } from './board-relations'
import { checkVerdictGesture, type VerdictBlock } from './design-unit-state'
import { ensureZonesForUnit } from './ensure-zones-for-unit'
import { framesInZone, stackFramesInZone, unitZone } from './board-zone-geometry'

// The reviewer's gesture: promote one option to lock its unit, or kill one
// option. The summary is the single ledger line; id and time are injectable so
// tests are deterministic. Optional placement keeps a drag-to-kill drop where
// the reviewer left the frame instead of restacking it.
export interface VerdictGestureInput {
  unitId: string
  frameId: string
  kind: 'promote' | 'kill'
  summary: string
  // The unit references the reviewer kept linked to this decision. Stored as-is
  // and never resolved against the board, so removing a reference later leaves
  // the past verdict untouched.
  referenceFrameIds?: string[]
  placement?: { x: number; y: number }
}

export type ApplyUnitVerdictResult =
  | { ok: true; document: BoardDocument; verdict: UnitVerdict }
  | { ok: false; reason: VerdictBlock | 'empty-summary' | 'invalid' }

// Applies one confirmed verdict to the board, atomically, and returns a fully
// re-validated document (relations included). Promote locks the unit, marks the
// winner `locked`, archives the unit's other active options into the archive
// zone, clears any nominee, and appends one promote row. Kill marks the frame
// `killed`, places it in the killed zone, clears a nominee that pointed at it,
// and appends one kill row.
export function applyUnitVerdict(
  document: BoardDocument,
  input: VerdictGestureInput,
  randomId: () => string = () => globalThis.crypto.randomUUID(),
  now: () => string = () => new Date().toISOString(),
): ApplyUnitVerdictResult {
  const gate = checkVerdictGesture(document, input.unitId, input.frameId)
  if (!gate.ok) return { ok: false, reason: gate.block }

  const summary = input.summary.trim()
  if (!summary) return { ok: false, reason: 'empty-summary' }

  const { frame } = gate
  // The decision is recorded against the kit state the reviewer saw. A frame
  // without a kit carries a null snapshot, as the relation rules require.
  const kitSnapshot: Record<string, KitStateValue> | null = frame.kit ? { ...frame.kit.state } : null
  const verdict: UnitVerdict = {
    id: randomId(),
    unitId: input.unitId,
    frameId: input.frameId,
    kind: input.kind,
    summary,
    createdAt: now(),
    kitSnapshot,
    referenceFrameIds: [...new Set(input.referenceFrameIds ?? [])],
  }

  let frames: BoardDocument['frames']
  let units: BoardDocument['units']
  if (input.kind === 'promote') {
    frames = document.frames.map((item) => {
      if (item.id === input.frameId) return { ...item, lifeState: 'locked' as const }
      if (item.unitId === input.unitId && isOptionFrame(item) && item.lifeState === 'active') {
        return { ...item, lifeState: 'archived' as const }
      }
      return item
    })
    units = document.units.map((unit) => unit.id === input.unitId
      ? { ...unit, state: 'locked' as const, lockedFrameId: input.frameId, nomineeFrameId: undefined }
      : unit)
  } else {
    frames = document.frames.map((item) => item.id === input.frameId
      ? { ...item, lifeState: 'killed' as const }
      : item)
    units = document.units.map((unit) => (unit.id === input.unitId && unit.nomineeFrameId === input.frameId)
      ? { ...unit, nomineeFrameId: undefined }
      : unit)
  }

  let candidate: BoardDocument = { ...document, frames, units, verdicts: [...document.verdicts, verdict] }
  candidate = ensureZonesForUnit(candidate, input.unitId)
  const archiveZone = unitZone(candidate, input.unitId, 'archive')
  const killedZone = unitZone(candidate, input.unitId, 'killed')
  if (!archiveZone || !killedZone) return { ok: false, reason: 'invalid' }

  if (input.kind === 'promote') {
    // Already-zoned archived frames keep their place; newly archived ones stack.
    const entrants = candidate.frames.filter((item) => item.unitId === input.unitId
      && item.lifeState === 'archived'
      && item.zoneId !== archiveZone.id)
    candidate = stackEntrantsIntoZone(candidate, archiveZone, entrants)
  } else if (input.placement) {
    const placement = input.placement
    candidate = {
      ...candidate,
      frames: candidate.frames.map((item) => item.id === input.frameId
        ? { ...item, zoneId: killedZone.id, x: placement.x, y: placement.y }
        : item),
    }
  } else {
    const entrants = candidate.frames.filter((item) => item.id === input.frameId)
    candidate = stackEntrantsIntoZone(candidate, killedZone, entrants)
  }

  const parsed = BoardDocumentSchema.safeParse(candidate)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return { ok: true, document: parsed.data, verdict }
}

// Stacks the entrant frames into the zone and grows the zone's stored bounds in
// the same step, so every auto-placed frame lies fully inside the zone it now
// belongs to. Frames already in the zone are never moved.
function stackEntrantsIntoZone(
  document: BoardDocument,
  zone: BoardZone,
  entrants: ScreenFrame[],
): BoardDocument {
  const { positions, bounds } = stackFramesInZone(zone, framesInZone(document, zone.id), entrants)
  const positionById = new Map(entrants.map((item, index) => [item.id, positions[index]!]))
  return {
    ...document,
    zones: document.zones.map((item) => (item.id === zone.id ? { ...item, ...bounds } : item)),
    frames: document.frames.map((item) => {
      const position = positionById.get(item.id)
      return position ? { ...item, zoneId: zone.id, ...position } : item
    }),
  }
}
