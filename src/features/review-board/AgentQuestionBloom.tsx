import { useEffect, useRef, useState } from 'react'
import './AgentQuestionBloom.css'

// An agent-authored note anchored on a frame. Read-only in 4c: the body text
// and the run that authored it. Editing a reply / learn pin lands in 4d.
export function AgentQuestionBloom({
  kind = 'agent-question',
  instruction,
  runId,
  onClose,
}: {
  kind?: 'agent-question' | 'teach'
  instruction: string
  runId?: string
  onClose: () => void
}) {
  const title = kind === 'teach' ? 'Teach note' : 'Agent question'
  const rootRef = useRef<HTMLElement>(null)
  // The element that opened the bloom, captured during the first render so the
  // close can hand focus back to it.
  const [opener] = useState<HTMLElement | null>(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null)
  useEffect(() => {
    // The bloom is a dialog: focus enters it on open. preventScroll keeps the
    // canvas from jumping when the note blooms inside a React Flow node.
    rootRef.current?.focus({ preventScroll: true })
    return () => {
      // Hand focus back only on a real unmount: Strict Mode re-runs this
      // cleanup while the bloom's DOM is still attached, and then focus must
      // stay inside.
      if (rootRef.current?.isConnected) return
      if (opener?.isConnected) opener.focus()
    }
  }, [opener])
  return (
    <aside
      ref={rootRef}
      className={`agent-question-bloom ${kind}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      data-testid={kind === 'teach' ? 'teach-note-bloom' : 'agent-question-bloom'}
      onKeyDown={(event) => {
        // Escape closes from inside the bloom itself, so every mount context
        // (canvas node included) gets it without the host wiring a key.
        if (event.key !== 'Escape') return
        event.stopPropagation()
        onClose()
      }}
    >
      <header className="agent-question-bloom-header">
        <span className="agent-question-bloom-glyph" aria-hidden="true">⌁</span>
        <p className="agent-question-bloom-title">{title}</p>
        <button
          type="button"
          className="agent-question-bloom-close"
          data-testid="agent-question-close"
          aria-label={`Close ${title.toLowerCase()}`}
          onClick={onClose}
        >
          Close
        </button>
      </header>
      <p className="agent-question-bloom-body">{instruction}</p>
      {runId ? (
        <p className="agent-question-bloom-run">
          Run <span className="agent-question-bloom-mono">{runId.slice(0, 8)}</span>
        </p>
      ) : null}
    </aside>
  )
}
