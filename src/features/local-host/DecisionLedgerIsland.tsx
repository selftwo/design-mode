import { useMemo } from 'react'
import { useCollapsedPanelState } from '../review-board/use-collapsed-panel-state'
import type { BoardDocument } from '../review-board/model/board-document.schema'
import './DecisionLedgerIsland.css'

// One rendered ledger line: a confirmed verdict resolved to the labels a reviewer
// recognizes, plus the kit state the decision was made against.
interface LedgerReference {
  id: string
  label: string
  missing: boolean
}

interface LedgerRow {
  id: string
  kind: 'promote' | 'kill'
  kindText: string
  unitLabel: string
  frameLabel: string
  summary: string
  kit: string | null
  references: LedgerReference[]
}

function buildLedgerRows(document: BoardDocument): LedgerRow[] {
  const unitLabel = new Map(document.units.map((unit) => [unit.id, unit.label]))
  const frameLabel = new Map(document.frames.map((frame) => [frame.id, frame.label]))
  // Newest first: the last confirmed decision reads at the top.
  return [...document.verdicts].reverse().map((verdict) => ({
    id: verdict.id,
    kind: verdict.kind,
    kindText: verdict.kind === 'promote' ? 'Locked' : 'Killed',
    unitLabel: unitLabel.get(verdict.unitId) ?? verdict.unitId,
    frameLabel: frameLabel.get(verdict.frameId) ?? 'a removed option',
    summary: verdict.summary,
    kit: verdict.kitSnapshot
      ? Object.entries(verdict.kitSnapshot).map(([id, value]) => `${id}: ${String(value)}`).join(', ')
      : null,
    // A reference deleted after the fact is kept on the verdict and shown as
    // missing, never rewritten out of the record.
    references: verdict.referenceFrameIds.map((frameId) => ({
      id: frameId,
      label: frameLabel.get(frameId) ?? 'reference missing',
      missing: !frameLabel.has(frameId),
    })),
  }))
}

// The decision ledger: every confirmed verdict, newest first, each linked to the
// unit and option it decided. Reads straight from the board, so a reload or a
// host save keeps it truthful. It appears only once at least one verdict exists.
export function DecisionLedgerIsland({ document }: { document: BoardDocument }) {
  const [collapsed, setCollapsed] = useCollapsedPanelState('decision-ledger-collapsed', false)
  const rows = useMemo(() => buildLedgerRows(document), [document])

  if (collapsed) {
    return (
      <button
        type="button"
        className="decision-ledger-toggle"
        aria-expanded={false}
        data-testid="toggle-decision-ledger"
        onClick={() => setCollapsed(false)}
      >
        Ledger ({rows.length})
      </button>
    )
  }

  return (
    <aside className="decision-ledger-island" aria-label="Decision ledger" data-testid="decision-ledger-island">
      <header className="decision-ledger-header">
        <h2>Decisions</h2>
        <button
          type="button"
          className="decision-ledger-toggle"
          aria-expanded
          data-testid="toggle-decision-ledger"
          onClick={() => setCollapsed(true)}
        >
          Hide
        </button>
      </header>
      <ul className="decision-ledger-list" data-testid="decision-ledger-list">
        {rows.map((row) => (
          <li key={row.id} className={`decision-ledger-row ${row.kind}`} data-testid={`ledger-row-${row.id}`}>
            <div className="decision-ledger-line">
              <span className={`decision-ledger-badge ${row.kind}`}>{row.kindText}</span>
              <span className="decision-ledger-frame">{row.frameLabel}</span>
              <span className="decision-ledger-unit">in {row.unitLabel}</span>
            </div>
            <p className="decision-ledger-summary">{row.summary}</p>
            {row.kit ? <p className="decision-ledger-kit">Kit: {row.kit}</p> : null}
            {row.references.length > 0 ? (
              <ul className="decision-ledger-references" data-testid={`ledger-references-${row.id}`}>
                {row.references.map((reference) => (
                  <li
                    key={reference.id}
                    className={`decision-ledger-reference ${reference.missing ? 'missing' : ''}`}
                  >
                    {reference.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </aside>
  )
}
