import { useState } from 'react'
import './VerdictConfirmBloom.css'

// A reference the reviewer can link to this decision. The label is what the
// ledger and the next generation prompt will name.
export interface VerdictReferenceOption {
  id: string
  label: string
}

// The small confirmation that blooms from a stamp or strike gesture: one summary
// line for the ledger, the unit's references (all pre-selected, each can be
// unchecked), then Confirm or Cancel. It carries no board knowledge; the parent
// applies the verdict and saves. A blank summary cannot be confirmed, so the
// ledger row always has a line.
export function VerdictConfirmBloom({
  kind,
  frameLabel,
  references = [],
  warning = null,
  onConfirm,
  onCancel,
}: {
  kind: 'promote' | 'kill'
  frameLabel: string
  references?: VerdictReferenceOption[]
  // A non-blocking review heads-up (item 6). Shown but never disables confirm.
  warning?: string | null
  onConfirm: (summary: string, referenceFrameIds: string[]) => void
  onCancel: () => void
}) {
  const [summary, setSummary] = useState(
    kind === 'promote' ? `Locked ${frameLabel} as the direction.` : `Killed ${frameLabel}.`,
  )
  // References start selected, matching "the verdict form pre-selects the unit's
  // references"; unchecking one drops it from this verdict only.
  const [linkedIds, setLinkedIds] = useState<Set<string>>(() => new Set(references.map((reference) => reference.id)))
  const toggle = (id: string) => {
    setLinkedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const title = kind === 'promote' ? 'Lock this option' : 'Kill this option'
  const confirmLabel = kind === 'promote' ? 'Lock' : 'Kill'
  const disabled = summary.trim().length === 0

  return (
    <form
      className={`verdict-bloom ${kind}`}
      role="dialog"
      aria-label={title}
      data-testid="verdict-bloom"
      onSubmit={(event) => {
        event.preventDefault()
        if (!disabled) onConfirm(summary, references.filter((reference) => linkedIds.has(reference.id)).map((reference) => reference.id))
      }}
    >
      <p className="verdict-bloom-title">{title}</p>
      <label className="verdict-bloom-field">
        <span>One line for the ledger</span>
        <input
          value={summary}
          data-testid="verdict-summary"
          autoFocus
          onChange={(event) => setSummary(event.target.value)}
        />
      </label>
      {references.length > 0 ? (
        <fieldset className="verdict-bloom-references" data-testid="verdict-references">
          <legend>References</legend>
          {references.map((reference) => (
            <label key={reference.id} className="verdict-bloom-reference">
              <input
                type="checkbox"
                checked={linkedIds.has(reference.id)}
                data-testid={`verdict-reference-${reference.id}`}
                onChange={() => toggle(reference.id)}
              />
              {reference.label}
            </label>
          ))}
        </fieldset>
      ) : null}
      {warning ? <p className="verdict-bloom-warning" role="note" data-testid="verdict-warning">{warning}</p> : null}
      <div className="verdict-bloom-actions">
        <button type="button" className="verdict-bloom-cancel" data-testid="verdict-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="verdict-bloom-confirm" data-testid="verdict-confirm" disabled={disabled}>
          {confirmLabel}
        </button>
      </div>
    </form>
  )
}
