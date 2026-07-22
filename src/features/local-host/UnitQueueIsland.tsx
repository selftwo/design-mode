import { useMemo, useState } from 'react'
import { useCollapsedPanelState } from '../review-board/use-collapsed-panel-state'
import { createDesignUnit } from '../review-board/model/create-design-unit'
import type { BoardDocument, DesignUnit } from '../review-board/model/board-document.schema'
import type { ImmediateSaveResult } from '../review-board/use-review-board-persistence'
import { buildUnitQueueRows } from './unit-queue-model'
import { GenerateOptionsPanel } from './GenerateOptionsPanel'
import type { LocalHostClient } from './local-host-client'
import './UnitQueueIsland.css'

// The unit queue: the reviewer's list of decisions. Each row shows whether a
// unit is open, blocked by a dependency, or locked. The reviewer creates units
// here and generates options for the selected one through the composed form.
// Unit state lives in the board document (client-owned); this island only reads
// it and appends new units.
export function UnitQueueIsland({
  document,
  client,
  selectedUnitId,
  onSelectUnit,
  onDocumentChange,
  onSaveImmediately,
}: {
  document: BoardDocument
  client: LocalHostClient
  selectedUnitId: string | null
  onSelectUnit: (unitId: string | null) => void
  onDocumentChange: (next: BoardDocument) => void
  onSaveImmediately: (document: BoardDocument) => Promise<ImmediateSaveResult>
}) {
  const [collapsed, setCollapsed] = useCollapsedPanelState('unit-queue-collapsed', false)
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState('')
  const [brief, setBrief] = useState('')
  const [rulesText, setRulesText] = useState('')
  const [draftDeps, setDraftDeps] = useState<string[]>([])
  const [createError, setCreateError] = useState<string | null>(null)

  const rows = useMemo(() => buildUnitQueueRows(document), [document])

  const selectedUnit: DesignUnit | null = selectedUnitId
    ? document.units.find((unit) => unit.id === selectedUnitId) ?? null
    : null

  const toggleDep = (id: string) => {
    setDraftDeps((current) => (current.includes(id) ? current.filter((dep) => dep !== id) : [...current, id]))
  }

  const submitCreate = () => {
    try {
      const created = createDesignUnit(document, { label, brief, rulesText, dependsOnUnitIds: draftDeps })
      onDocumentChange(created.document)
      onSelectUnit(created.unit.id)
      setLabel('')
      setBrief('')
      setRulesText('')
      setDraftDeps([])
      setCreateError(null)
      setCreating(false)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'The unit could not be created.')
    }
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className="unit-queue-toggle"
        aria-expanded={false}
        data-testid="toggle-unit-queue"
        onClick={() => setCollapsed(false)}
      >
        Units
      </button>
    )
  }

  return (
    <aside className="unit-queue-island" aria-label="Unit queue" data-testid="unit-queue-island">
      <header className="unit-queue-header">
        <h2>Units</h2>
        <button
          type="button"
          className="unit-queue-toggle"
          aria-expanded
          data-testid="toggle-unit-queue"
          onClick={() => setCollapsed(true)}
        >
          Hide
        </button>
      </header>

      {rows.length === 0 ? (
        <p className="unit-queue-empty" data-testid="unit-queue-empty">No units yet. Create the first decision to review.</p>
      ) : (
        <ul className="unit-queue-list" data-testid="unit-queue-list">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={`unit-queue-row ${row.state} ${row.id === selectedUnitId ? 'selected' : ''}`}
                aria-pressed={row.id === selectedUnitId}
                data-testid={`unit-queue-row-${row.id}`}
                onClick={() => onSelectUnit(row.id)}
              >
                <span className="unit-queue-row-label">{row.label}</span>
                <span className={`unit-queue-row-state ${row.state}`} data-testid={`unit-queue-state-${row.id}`}>{row.stateText}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <div className="unit-queue-create" data-testid="unit-queue-create">
          <label className="unit-queue-field">
            Label
            <input value={label} onChange={(event) => setLabel(event.target.value)} data-testid="unit-create-label" />
          </label>
          <label className="unit-queue-field">
            Brief
            <textarea value={brief} onChange={(event) => setBrief(event.target.value)} rows={2} data-testid="unit-create-brief" />
          </label>
          <label className="unit-queue-field">
            Rules (one per line)
            <textarea value={rulesText} onChange={(event) => setRulesText(event.target.value)} rows={2} data-testid="unit-create-rules" />
          </label>
          {document.units.length > 0 ? (
            <fieldset className="unit-queue-deps">
              <legend>Depends on</legend>
              {document.units.map((unit) => (
                <label key={unit.id} className="unit-queue-dep">
                  <input
                    type="checkbox"
                    checked={draftDeps.includes(unit.id)}
                    onChange={() => toggleDep(unit.id)}
                    data-testid={`unit-create-dep-${unit.id}`}
                  />
                  {unit.label}
                </label>
              ))}
            </fieldset>
          ) : null}
          {createError ? <p className="unit-queue-error" role="alert" data-testid="unit-create-error">{createError}</p> : null}
          <div className="unit-queue-create-actions">
            <button type="button" className="unit-queue-secondary" onClick={() => { setCreating(false); setCreateError(null) }}>Cancel</button>
            <button type="button" className="unit-queue-primary" data-testid="unit-create-submit" onClick={submitCreate}>Add unit</button>
          </div>
        </div>
      ) : (
        <button type="button" className="unit-queue-add" data-testid="unit-queue-add" onClick={() => setCreating(true)}>
          New unit
        </button>
      )}

      <GenerateOptionsPanel
        document={document}
        unit={selectedUnit}
        client={client}
        onSaveImmediately={onSaveImmediately}
      />
    </aside>
  )
}
