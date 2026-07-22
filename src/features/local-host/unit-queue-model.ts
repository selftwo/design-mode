import { getUnitGenerationEligibility } from '../review-board/model/unit-generation-eligibility'
import type { BoardDocument } from '../review-board/model/board-document.schema'

// One row in the unit queue: the state to show and whether Generate is allowed.
export interface UnitQueueRow {
  id: string
  label: string
  state: 'open' | 'blocked' | 'locked'
  stateText: string
  canGenerate: boolean
}

// Turns the board's units into display rows in stored order. Blocked rows name
// the dependencies still holding them, by label where one is known.
export function buildUnitQueueRows(document: BoardDocument): UnitQueueRow[] {
  const labelById = new Map(document.units.map((unit) => [unit.id, unit.label]))
  return document.units.map((unit) => {
    const eligibility = getUnitGenerationEligibility(document, unit.id)
    if (eligibility.kind === 'locked') {
      return { id: unit.id, label: unit.label, state: 'locked', stateText: 'Locked', canGenerate: false }
    }
    if (eligibility.kind === 'blocked') {
      const names = eligibility.blockingUnitIds.map((depId) => labelById.get(depId) ?? depId)
      return { id: unit.id, label: unit.label, state: 'blocked', stateText: `Blocked by: ${names.join(', ')}`, canGenerate: false }
    }
    // A unit's own id always resolves, so the only remaining case is eligible.
    return { id: unit.id, label: unit.label, state: 'open', stateText: 'Open', canGenerate: true }
  })
}
