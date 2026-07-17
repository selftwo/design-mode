import { useEffect, useState } from 'react'
import { useCollapsedPanelState } from '../review-board/use-collapsed-panel-state'
import type { ContextFile } from './host-api.schema'
import type { LocalHostClient } from './local-host-client'
import './DesignContextPane.css'

// The project's own design ground truth (DESIGN.md, PRODUCT.md, AGENTS.md,
// README.md), readable while reviewing so feedback and dispatched batches
// speak the project's language.
export function DesignContextPane({ client }: { client: LocalHostClient }) {
  const [collapsed, setCollapsed] = useCollapsedPanelState('design-review-context-collapsed', true)
  const [files, setFiles] = useState<ContextFile[] | null>(null)
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    client.getContext()
      .then((loaded) => {
        setFiles(loaded)
        setActiveFile(loaded[0]?.name ?? null)
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Design context could not be loaded.')
      })
  }, [client])

  if (collapsed) {
    return (
      <aside className="context-pane collapsed" aria-label="Project design context">
        <button
          type="button"
          className="context-toggle"
          aria-expanded={false}
          title="Show design context"
          data-testid="toggle-context-pane"
          onClick={() => setCollapsed(false)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M3 2.5h7.5L13 5v8.5H3z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M5.4 7h5.2M5.4 9.4h5.2M5.4 11.8h3.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span className="context-toggle-label">Context</span>
        </button>
      </aside>
    )
  }

  const active = files?.find((file) => file.name === activeFile) ?? null

  return (
    <aside className="context-pane" aria-label="Project design context" data-testid="context-pane">
      <header className="context-header">
        <h2>Design context</h2>
        <button
          type="button"
          className="context-toggle"
          aria-expanded
          title="Hide design context"
          data-testid="toggle-context-pane"
          onClick={() => setCollapsed(true)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M9.8 3.5 5.3 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </header>
      {error ? <p role="alert" className="context-error">{error}</p> : null}
      {files !== null && files.length === 0 ? (
        <p className="context-empty">
          This project has no DESIGN.md, PRODUCT.md, AGENTS.md, or README.md yet. Adding a DESIGN.md gives agents a
          visual direction to follow.
        </p>
      ) : null}
      {files !== null && files.length > 0 ? (
        <>
          <nav className="context-tabs" aria-label="Context files">
            {files.map((file) => (
              <button
                key={file.name}
                type="button"
                aria-pressed={file.name === activeFile}
                onClick={() => setActiveFile(file.name)}
                data-testid={`context-tab-${file.name}`}
              >
                {file.name}
              </button>
            ))}
          </nav>
          <pre className="context-body" data-testid="context-body">{active?.content ?? ''}</pre>
        </>
      ) : null}
    </aside>
  )
}
