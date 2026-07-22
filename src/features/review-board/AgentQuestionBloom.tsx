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
  return (
    <aside
      className={`agent-question-bloom ${kind}`}
      role="dialog"
      aria-label={title}
      data-testid={kind === 'teach' ? 'teach-note-bloom' : 'agent-question-bloom'}
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
