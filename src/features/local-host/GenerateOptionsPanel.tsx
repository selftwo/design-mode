import { useEffect, useMemo, useState } from 'react'
import { getUnitGenerationEligibility } from '../review-board/model/unit-generation-eligibility'
import type { BoardDocument, DesignUnit } from '../review-board/model/board-document.schema'
import type { ImmediateSaveResult } from '../review-board/use-review-board-persistence'
import { startUnitGeneration, type UnitGenerationStage } from './start-unit-generation'
import type { LocalHostClient } from './local-host-client'
import './GenerateOptionsPanel.css'

const OPTION_COUNTS = [1, 2, 3, 4, 5, 6]

type Phase = 'idle' | 'saving' | 'sending' | 'sent' | 'error'

// The selected-unit generation form. It never carries free prompt text: the
// host builds the agent request from the unit's brief and rules. Generation goes
// through the save gate so the unit reaches the host before the run is asked for.
export function GenerateOptionsPanel({
  document,
  unit,
  client,
  onSaveImmediately,
}: {
  document: BoardDocument
  unit: DesignUnit | null
  client: LocalHostClient
  onSaveImmediately: (document: BoardDocument) => Promise<ImmediateSaveResult>
}) {
  const [count, setCount] = useState(3)
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<string | null>(null)

  // A change of selection clears any stale status from the previous unit.
  useEffect(() => {
    setPhase('idle')
    setMessage(null)
  }, [unit?.id])

  const eligibility = useMemo(
    () => (unit ? getUnitGenerationEligibility(document, unit.id) : null),
    [document, unit],
  )

  if (!unit) {
    return (
      <p className="generate-options-empty" data-testid="generate-options-empty">
        Select a unit to generate options for it.
      </p>
    )
  }

  const busy = phase === 'saving' || phase === 'sending'
  const canGenerate = eligibility?.kind === 'eligible' && !busy

  const submit = () => {
    if (!canGenerate) return
    setPhase('saving')
    setMessage(null)
    void startUnitGeneration({
      document,
      unitId: unit.id,
      count,
      saveImmediately: onSaveImmediately,
      generateOptions: (input) => client.generateOptions(input),
      onStage: (stage: UnitGenerationStage) => setPhase(stage),
    }).then((result) => {
      switch (result.kind) {
        case 'started':
          setPhase('sent')
          setMessage(`Started options for ${unit.label}.`)
          return
        case 'save-failed':
          setPhase('error')
          setMessage(`The board could not be saved. No run was started. ${result.error}`)
          return
        case 'not-found':
          setPhase('error')
          setMessage(`The saved board no longer contains this unit. No run was started. ${result.error}`)
          return
        case 'conflict':
          setPhase('error')
          setMessage(`The host rejected this unit because it is locked or blocked. No run was started. ${result.error}`)
          return
        case 'ineligible':
          setPhase('error')
          setMessage('This unit cannot generate options right now.')
          return
        default:
          setPhase('error')
          setMessage(`Generation could not start. ${result.error}`)
      }
    })
  }

  return (
    <section className="generate-options-form" aria-label="Generate options for the selected unit" data-testid="generate-options-form">
      <h3 className="generate-options-unit-label" data-testid="generate-options-unit">{unit.label}</h3>
      {unit.brief ? <p className="generate-options-brief">{unit.brief}</p> : null}
      {unit.rules.length > 0 ? (
        <ul className="generate-options-rules">
          {unit.rules.map((rule, index) => <li key={index}>{rule}</li>)}
        </ul>
      ) : null}

      {eligibility?.kind === 'locked' ? (
        <p className="generate-options-reason" data-testid="generate-options-reason">This unit is locked; its winner is chosen.</p>
      ) : null}
      {eligibility?.kind === 'blocked' ? (
        <p className="generate-options-reason" data-testid="generate-options-reason">
          {`Blocked until these lock: ${eligibility.blockingUnitIds.map((id) => document.units.find((item) => item.id === id)?.label ?? id).join(', ')}.`}
        </p>
      ) : null}

      <div className="generate-options-row">
        <label className="generate-options-count">
          Options
          <select
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            data-testid="generate-options-count"
            disabled={busy}
          >
            {OPTION_COUNTS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="generate-options-submit"
          disabled={!canGenerate}
          data-testid="generate-options-submit"
          onClick={submit}
        >
          {phase === 'saving' ? 'Saving…' : phase === 'sending' ? 'Generating…' : 'Generate'}
        </button>
      </div>
      {phase === 'sent' && message ? (
        <p className="generate-options-notice" role="status" data-testid="generate-options-notice">{message}</p>
      ) : null}
      {phase === 'error' && message ? (
        <p className="generate-options-error" role="alert" data-testid="generate-options-error">{message}</p>
      ) : null}
    </section>
  )
}
