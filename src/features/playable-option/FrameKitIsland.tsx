import { useState } from 'react'
import type { KitStateValue, ReviewSummary, ScreenFrame } from '../review-board/model/board-document.schema'
import { isReviewed } from '../review-board/model/review-telemetry'
import { VerdictConfirmBloom, type VerdictReferenceOption } from '../review-board/VerdictConfirmBloom'
import type { PlayableInteractionMode } from './PlayableOptionFrame'
import './FrameKitIsland.css'

// The one-line review trace for the selected option: reviewed or not, rounded
// seconds looked at, and how many kit states were tried. Totals only.
function reviewLine(summary: ReviewSummary | undefined): string {
  if (!summary) return 'Not reviewed yet'
  const parts = [isReviewed(summary) ? 'Reviewed' : 'Not reviewed yet', `${summary.visibleSeconds}s`]
  if (summary.kitStatesTried > 0) parts.push(`${summary.kitStatesTried} kit state${summary.kitStatesTried === 1 ? '' : 's'}`)
  if (summary.playedLive) parts.push('played live')
  return parts.join(' · ')
}

// The dial for the selected playable option: its play/review mode and one
// control per kit manifest entry. Values read straight from the frame's saved
// kit state, so a host reload or board save stays the source of truth. Kit
// changes are frame-local; the parent writes them immutably into the board.
// When the option is a live candidate of an open unit, it also carries the
// stamp/strike verdict gesture: the parent applies and saves the confirmed row.
export function FrameKitIsland({
  frame,
  mode,
  canVerdict,
  references = [],
  reviewSummary,
  promoteWarning = null,
  onModeChange,
  onKitControlChange,
  onVerdict,
}: {
  frame: ScreenFrame
  mode: PlayableInteractionMode
  canVerdict: boolean
  references?: VerdictReferenceOption[]
  reviewSummary?: ReviewSummary
  promoteWarning?: string | null
  onModeChange: (mode: PlayableInteractionMode) => void
  onKitControlChange: (controlId: string, value: KitStateValue) => void
  onVerdict: (kind: 'promote' | 'kill', summary: string, referenceFrameIds: string[]) => void
}) {
  const [pending, setPending] = useState<'promote' | 'kill' | null>(null)
  const kit = frame.kit
  if (!kit) return null

  return (
    <aside className="frame-kit-island" aria-label={`Controls for ${frame.label}`} data-testid="frame-kit-island">
      <header className="frame-kit-header">
        <h2>{frame.label}</h2>
        <div className="frame-kit-modes" role="group" aria-label="Interaction mode">
          <button type="button" className="frame-kit-mode" aria-pressed={mode === 'play'} data-testid="frame-kit-play" onClick={() => onModeChange('play')}>Play</button>
          <button type="button" className="frame-kit-mode" aria-pressed={mode === 'review'} data-testid="frame-kit-review" onClick={() => onModeChange('review')}>Review</button>
        </div>
      </header>
      <div className="frame-kit-controls">
        {kit.manifest.controls.map((control) => {
          const value = kit.state[control.id]
          if (control.kind === 'toggle') {
            return (
              <label key={control.id} className="frame-kit-control">
                <input
                  type="checkbox"
                  checked={value === true}
                  data-testid={`kit-${frame.id}-${control.id}`}
                  onChange={(event) => onKitControlChange(control.id, event.target.checked)}
                />
                {control.label}
              </label>
            )
          }
          return (
            <label key={control.id} className="frame-kit-control frame-kit-choice">
              {control.label}
              <select
                value={typeof value === 'string' ? value : control.default}
                data-testid={`kit-${frame.id}-${control.id}`}
                onChange={(event) => onKitControlChange(control.id, event.target.value)}
              >
                {control.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          )
        })}
      </div>
      <p className="frame-kit-review" data-testid="frame-kit-review">{reviewLine(reviewSummary)}</p>
      {canVerdict ? (
        pending ? (
          <VerdictConfirmBloom
            kind={pending}
            frameLabel={frame.label}
            references={references}
            warning={pending === 'promote' ? promoteWarning : null}
            onConfirm={(summary, referenceFrameIds) => {
              onVerdict(pending, summary, referenceFrameIds)
              setPending(null)
            }}
            onCancel={() => setPending(null)}
          />
        ) : (
          <div className="frame-kit-verdict" role="group" aria-label="Verdict">
            <button type="button" className="frame-kit-stamp" data-testid="frame-verdict-promote" onClick={() => setPending('promote')}>
              Lock this
            </button>
            <button type="button" className="frame-kit-strike" data-testid="frame-verdict-kill" onClick={() => setPending('kill')}>
              Kill this
            </button>
          </div>
        )
      ) : null}
    </aside>
  )
}
