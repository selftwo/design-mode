import type { BoardDocument, BoardZone } from './board-document.schema'
import { defaultZoneLayout, unitFrameBounds, unitZone } from './board-zone-geometry'

function zoneId(unitId: string, kind: 'archive' | 'killed'): string {
  return `${unitId}-${kind}`
}

function buildZone(
  unitId: string,
  kind: 'archive' | 'killed',
  layout: ReturnType<typeof defaultZoneLayout>,
): BoardZone {
  const rect = layout[kind]
  return {
    id: zoneId(unitId, kind),
    unitId,
    kind,
    label: kind === 'archive' ? 'Archive' : 'Killed',
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    collapsed: false,
  }
}

// Idempotent: a unit always ends up with exactly one archive and one killed
// zone. Missing zones are appended with default world geometry; existing ones
// are left alone so a reviewer's layout does not jump. This does not run the
// full board schema — callers that mutate lifeState still need to assign
// zoneIds before a final BoardDocumentSchema parse.
export function ensureZonesForUnit(document: BoardDocument, unitId: string): BoardDocument {
  if (!document.units.some((unit) => unit.id === unitId)) return document
  const hasArchive = Boolean(unitZone(document, unitId, 'archive'))
  const hasKilled = Boolean(unitZone(document, unitId, 'killed'))
  if (hasArchive && hasKilled) return document

  const layout = defaultZoneLayout(unitId, unitFrameBounds(document.frames, unitId))
  const zones = [...document.zones]
  if (!hasArchive) zones.push(buildZone(unitId, 'archive', layout))
  if (!hasKilled) zones.push(buildZone(unitId, 'killed', layout))
  return { ...document, zones }
}

export function ensureZonesForAllUnits(document: BoardDocument): BoardDocument {
  return document.units.reduce(
    (current, unit) => ensureZonesForUnit(current, unit.id),
    document,
  )
}
