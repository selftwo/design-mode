import { useEffect, useState } from 'react'
import type { ContextFile } from '@/features/local-host/host-api.schema'
import type { LocalHostClient } from '@/features/local-host/local-host-client'

export function DesignContextInIsland({ client }: { client: LocalHostClient }) {
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

  if (files === null && !error) return null

  const active = files?.find((file) => file.name === activeFile) ?? null

  return (
    <section
      className="design-context-in-island"
      aria-label="Project design context"
      data-testid="context-pane"
    >
      <div className="dm-sect">Design context</div>
      {error ? <p role="alert" className="context-error">{error}</p> : null}
      {files !== null && files.length === 0 ? (
        <p className="context-empty">
          This project has no DESIGN.md, PRODUCT.md, AGENTS.md, or README.md yet. Adding a DESIGN.md gives agents a
          visual direction to follow.
        </p>
      ) : null}
      {files !== null && files.length > 0 ? (
        <>
          <nav className="context-tabs dm-tabs" aria-label="Context files">
            {files.map((file) => (
              <button
                key={file.name}
                type="button"
                className="dm-tab"
                aria-pressed={file.name === activeFile}
                onClick={() => setActiveFile(file.name)}
                data-testid={`context-tab-${file.name}`}
              >
                {file.name}
              </button>
            ))}
          </nav>
          <pre className="context-body dm-mono" data-testid="context-body">{active?.content ?? ''}</pre>
        </>
      ) : null}
    </section>
  )
}
