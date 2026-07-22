import { isOptionFrame } from './board-relations'
import type { BoardDocument, DesignUnit, ScreenFrame } from './board-document.schema'

// The option frames that belong to one unit: the candidates a reviewer compares
// and then verdicts on. Both live playable options and migrated snapshots count.
export function unitOptionFrames(document: BoardDocument, unitId: string): ScreenFrame[] {
  return document.frames.filter((frame) => frame.unitId === unitId && isOptionFrame(frame))
}

// Why a verdict gesture cannot proceed right now. The UI only offers the gesture
// on an active option of an open unit, but the model rechecks so it never builds
// a board the relation rules would reject.
export type VerdictBlock =
  | 'unit-missing'
  | 'unit-locked'
  | 'frame-missing'
  | 'not-an-option'
  | 'frame-not-active'

export type VerdictGate =
  | { ok: true; unit: DesignUnit; frame: ScreenFrame }
  | { ok: false; block: VerdictBlock }

// The precondition promote and kill share: the unit is still open and the named
// frame is one of its active option frames. A locked unit is already decided; an
// archived, killed, or already-locked frame is not a live candidate.
export function checkVerdictGesture(document: BoardDocument, unitId: string, frameId: string): VerdictGate {
  const unit = document.units.find((item) => item.id === unitId)
  if (!unit) return { ok: false, block: 'unit-missing' }
  if (unit.state !== 'open') return { ok: false, block: 'unit-locked' }

  const frame = document.frames.find((item) => item.id === frameId)
  if (!frame) return { ok: false, block: 'frame-missing' }
  if (!isOptionFrame(frame) || frame.unitId !== unitId) return { ok: false, block: 'not-an-option' }
  if (frame.lifeState !== 'active') return { ok: false, block: 'frame-not-active' }

  return { ok: true, unit, frame }
}
