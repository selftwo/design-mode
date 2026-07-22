import { BoardDocumentSchema, type BoardDocument } from './board-document.schema'
import { isOptionFrame } from './board-relations'
import { zoneContainsCenter, zoneForDrop } from './board-zone-geometry'
import { ensureZonesForUnit } from './ensure-zones-for-unit'

export type DragStopIntent =
  | { kind: 'reposition-only' }
  | { kind: 'archive'; zoneId: string }
  | { kind: 'kill-confirm'; zoneId: string; dropPosition: { x: number; y: number } }
  | { kind: 'restore-active' }
  | { kind: 'snap-back' }

export type MoveFrameResult =
  | { ok: true; document: BoardDocument }
  | { ok: false; reason: 'frame-missing' | 'no-unit' | 'not-option' | 'not-active' | 'not-archived' | 'unit-locked' | 'invalid' }

// Pure classification of a frame drag-stop against the unit's zones. A drop on
// the killed zone never mutates lifeState here — it only requests confirmation,
// because a killed frame must carry a matching kill verdict.
export function classifyFrameDragStop(
  document: BoardDocument,
  frameId: string,
  position: { x: number; y: number },
): DragStopIntent {
  const frame = document.frames.find((item) => item.id === frameId)
  if (!frame) return { kind: 'reposition-only' }

  if (frame.lifeState === 'active' && isOptionFrame(frame) && frame.unitId) {
    const zone = zoneForDrop(document, frame, position)
    if (zone?.kind === 'killed') {
      return { kind: 'kill-confirm', zoneId: zone.id, dropPosition: position }
    }
    if (zone?.kind === 'archive') {
      return { kind: 'archive', zoneId: zone.id }
    }
    return { kind: 'reposition-only' }
  }

  if (frame.lifeState === 'archived' && frame.zoneId) {
    const zone = document.zones.find((item) => item.id === frame.zoneId)
    const positioned = { ...frame, ...position }
    if (zone && zoneContainsCenter(zone, positioned)) return { kind: 'reposition-only' }
    const unit = document.units.find((item) => item.id === frame.unitId)
    // Promote-archived losers sit under a locked unit; they stay archived.
    if (unit?.state === 'open') return { kind: 'restore-active' }
    return { kind: 'snap-back' }
  }

  if (frame.lifeState === 'killed' && frame.zoneId) {
    const zone = document.zones.find((item) => item.id === frame.zoneId)
    const positioned = { ...frame, ...position }
    if (zone && zoneContainsCenter(zone, positioned)) return { kind: 'reposition-only' }
    // A kill verdict is durable; dragging out never restores the frame.
    return { kind: 'snap-back' }
  }

  return { kind: 'reposition-only' }
}

export function moveFrameToArchiveZone(
  document: BoardDocument,
  frameId: string,
  position: { x: number; y: number },
): MoveFrameResult {
  const frame = document.frames.find((item) => item.id === frameId)
  if (!frame) return { ok: false, reason: 'frame-missing' }
  if (!frame.unitId) return { ok: false, reason: 'no-unit' }
  if (!isOptionFrame(frame)) return { ok: false, reason: 'not-option' }
  if (frame.lifeState !== 'active') return { ok: false, reason: 'not-active' }

  const withZones = ensureZonesForUnit(document, frame.unitId)
  const archive = withZones.zones.find((zone) => zone.unitId === frame.unitId && zone.kind === 'archive')
  if (!archive) return { ok: false, reason: 'invalid' }

  const frames = withZones.frames.map((item) => {
    if (item.id !== frameId) return item
    return { ...item, x: position.x, y: position.y, lifeState: 'archived' as const, zoneId: archive.id }
  })
  const units = withZones.units.map((unit) => (unit.id === frame.unitId && unit.nomineeFrameId === frameId)
    ? { ...unit, nomineeFrameId: undefined }
    : unit)

  const parsed = BoardDocumentSchema.safeParse({ ...withZones, frames, units })
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return { ok: true, document: parsed.data }
}

export function restoreFrameFromZone(
  document: BoardDocument,
  frameId: string,
  position: { x: number; y: number },
): MoveFrameResult {
  const frame = document.frames.find((item) => item.id === frameId)
  if (!frame) return { ok: false, reason: 'frame-missing' }
  if (frame.lifeState !== 'archived') return { ok: false, reason: 'not-archived' }
  if (!frame.unitId) return { ok: false, reason: 'no-unit' }

  const unit = document.units.find((item) => item.id === frame.unitId)
  if (!unit) return { ok: false, reason: 'no-unit' }
  if (unit.state === 'locked') return { ok: false, reason: 'unit-locked' }

  const frames = document.frames.map((item) => {
    if (item.id !== frameId) return item
    const { zoneId: _zoneId, ...rest } = item
    return { ...rest, x: position.x, y: position.y, lifeState: 'active' as const }
  })

  const parsed = BoardDocumentSchema.safeParse({ ...document, frames })
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return { ok: true, document: parsed.data }
}

export function repositionFrame(
  document: BoardDocument,
  frameId: string,
  position: { x: number; y: number },
): MoveFrameResult {
  const frame = document.frames.find((item) => item.id === frameId)
  if (!frame) return { ok: false, reason: 'frame-missing' }
  const frames = document.frames.map((item) => item.id === frameId
    ? { ...item, x: position.x, y: position.y }
    : item)
  const parsed = BoardDocumentSchema.safeParse({ ...document, frames })
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return { ok: true, document: parsed.data }
}
