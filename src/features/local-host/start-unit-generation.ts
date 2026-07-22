import { getUnitGenerationEligibility, type UnitGenerationEligibility } from '../review-board/model/unit-generation-eligibility'
import type { ImmediateSaveResult } from '../review-board/use-review-board-persistence'
import type { BoardDocument } from '../review-board/model/board-document.schema'
import type { AgentRun } from './host-api.schema'
import { LocalHostRequestError } from './local-host-client'

export type UnitGenerationStage = 'saving' | 'sending'

// The closed set of outcomes for one generation attempt, so the UI maps each to
// a clear message without inspecting error strings.
export type StartUnitGenerationResult =
  | { kind: 'started'; run: AgentRun }
  | { kind: 'ineligible'; eligibility: UnitGenerationEligibility }
  | { kind: 'save-failed'; error: string }
  | { kind: 'not-found'; error: string }
  | { kind: 'conflict'; error: string }
  | { kind: 'request-failed'; error: string }

export interface StartUnitGenerationDeps {
  document: BoardDocument
  unitId: string
  count: number
  saveImmediately: (document: BoardDocument) => Promise<ImmediateSaveResult>
  generateOptions: (input: { unitId: string; count: number }) => Promise<AgentRun>
  onStage?: (stage: UnitGenerationStage) => void
}

// The ordered create/save/generate gate. It checks client eligibility first (no
// save or POST for a blocked or locked unit), then saves the exact board so the
// host sees the unit, then dispatches. A save failure stops before any run
// starts. 404 and 409 map to their own results and are never retried.
export async function startUnitGeneration(deps: StartUnitGenerationDeps): Promise<StartUnitGenerationResult> {
  const eligibility = getUnitGenerationEligibility(deps.document, deps.unitId)
  if (eligibility.kind !== 'eligible') return { kind: 'ineligible', eligibility }

  deps.onStage?.('saving')
  const saved = await deps.saveImmediately(deps.document)
  if (!saved.ok) return { kind: 'save-failed', error: saved.error }

  deps.onStage?.('sending')
  try {
    const run = await deps.generateOptions({ unitId: deps.unitId, count: deps.count })
    return { kind: 'started', run }
  } catch (error) {
    if (error instanceof LocalHostRequestError) {
      if (error.status === 404) return { kind: 'not-found', error: error.message }
      if (error.status === 409) return { kind: 'conflict', error: error.message }
    }
    return { kind: 'request-failed', error: error instanceof Error ? error.message : 'Generation could not start.' }
  }
}
