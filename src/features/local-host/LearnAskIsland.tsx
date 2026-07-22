import { useState } from 'react'
import './LearnAskIsland.css'

// The learn/ask affordance: a reviewer asks one question about the selected
// screen and the agent answers by pinning a teach note. It explains, it never
// dispatches a change. The pinned answer arrives on the canvas by request id.
export function LearnAskIsland({
  frameLabel,
  asking,
  pending,
  error,
  onAsk,
  onDismissError,
}: {
  frameLabel: string
  asking: boolean
  pending: number
  error: string | null
  onAsk: (question: string) => void
  onDismissError: () => void
}) {
  const [question, setQuestion] = useState('')
  const trimmed = question.trim()

  const submit = () => {
    if (!trimmed || asking) return
    onAsk(trimmed)
    setQuestion('')
  }

  return (
    <aside className="learn-ask-island" aria-label="Ask about this screen" data-testid="learn-ask-island">
      <header className="learn-ask-header">
        <span className="learn-ask-glyph" aria-hidden="true">⌁</span>
        <p className="learn-ask-title">Ask about {frameLabel}</p>
      </header>
      <textarea
        className="learn-ask-input"
        data-testid="learn-ask-input"
        value={question}
        placeholder="What is this element, and how is it built?"
        aria-label="Your question about this screen"
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            submit()
          }
        }}
      />
      <div className="learn-ask-actions">
        {pending > 0 ? (
          <span className="learn-ask-pending" role="status" data-testid="learn-ask-pending">
            {pending} waiting for an answer
          </span>
        ) : null}
        <button
          type="button"
          className="learn-ask-submit"
          data-testid="learn-ask-submit"
          disabled={!trimmed || asking}
          onClick={submit}
        >
          {asking ? 'Asking…' : 'Ask'}
        </button>
      </div>
      {error ? (
        <p className="learn-ask-error" role="alert" data-testid="learn-ask-error">
          {error}
          <button type="button" className="learn-ask-dismiss" onClick={onDismissError} aria-label="Dismiss learn error">×</button>
        </p>
      ) : null}
    </aside>
  )
}
