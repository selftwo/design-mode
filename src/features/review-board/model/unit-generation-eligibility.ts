import type { BoardDocument, DesignUnit } from './board-document.schema'

// Whether a design unit may start a new lo-fi option run. The same rule runs in
// the browser (to guide the reviewer and disable Generate) and on the host (as
// the final authority against its saved board), so the two never disagree about
// what "eligible" means.
export type UnitGenerationEligibility =
  | { kind: 'missing'; unitId: string }
  | { kind: 'eligible'; unit: DesignUnit }
  | { kind: 'blocked'; unit: DesignUnit; blockingUnitIds: string[] }
  | { kind: 'locked'; unit: DesignUnit }

export function getUnitGenerationEligibility(
  document: BoardDocument,
  unitId: string,
): UnitGenerationEligibility {
  const unit = document.units.find((item) => item.id === unitId)
  if (!unit) return { kind: 'missing', unitId }
  if (unit.state === 'locked') return { kind: 'locked', unit }

  // Every dependency of an open unit must be locked before it may generate. A
  // parsed board cannot name a missing dependency, but stay total: an unresolved
  // id counts as blocking so an unchecked caller never falls through to eligible.
  const stateById = new Map(document.units.map((item) => [item.id, item.state]))
  const blockingUnitIds = unit.dependsOnUnitIds.filter((depId) => stateById.get(depId) !== 'locked')
  if (blockingUnitIds.length > 0) return { kind: 'blocked', unit, blockingUnitIds }
  return { kind: 'eligible', unit }
}
