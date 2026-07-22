// THROWAWAY PROTOTYPE — see lofi-option-studio.ts. Floating panel that drives the
// compare/pick/hand-off step: prefer an option, then preview the handoff payload.
import { useMemo, useState } from 'react'
import type { BoardDocument } from '../model/board-document.schema'
import { buildLofiHandoffPayload } from './lofi-option-studio'
import './ProtoLofiPanel.css'

interface ProtoLofiPanelProps {
  document: BoardDocument
  optionHtml: Record<string, string>
  preferredFrameId: string | null
  onPrefer: (frameId: string) => void
  onSelectFrame: (frameId: string) => void
}

export function ProtoLofiPanel({
  document,
  optionHtml,
  preferredFrameId,
  onPrefer,
  onSelectFrame,
}: ProtoLofiPanelProps) {
  const [payloadShown, setPayloadShown] = useState(false)

  const payload = useMemo(
    () => (preferredFrameId ? buildLofiHandoffPayload(document, preferredFrameId, optionHtml) : null),
    [document, preferredFrameId, optionHtml],
  )

  const markCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const annotation of document.annotations) {
      counts[annotation.frameId] = (counts[annotation.frameId] ?? 0) + 1
    }
    return counts
  }, [document.annotations])

  return (
    <aside className="proto-lofi-panel" data-testid="proto-lofi-panel">
      <header className="proto-lofi-header">
        <strong>Lo-fi options</strong>
        <span className="proto-lofi-tag">prototype</span>
      </header>
      <p className="proto-lofi-hint">Mark up the options on the canvas, prefer one, then preview the handoff.</p>
      <ul className="proto-lofi-list">
        {document.frames.map((frame) => {
          const preferred = frame.id === preferredFrameId
          return (
            <li key={frame.id} className={preferred ? 'proto-lofi-item is-preferred' : 'proto-lofi-item'}>
              <button
                type="button"
                className="proto-lofi-label"
                onClick={() => onSelectFrame(frame.id)}
                title="Select on canvas"
              >
                {frame.label}
                {markCounts[frame.id] ? <span className="proto-lofi-marks">{markCounts[frame.id]} mark{markCounts[frame.id] === 1 ? '' : 's'}</span> : null}
              </button>
              <button
                type="button"
                className="proto-lofi-prefer"
                aria-pressed={preferred}
                data-testid={`proto-prefer-${frame.id}`}
                onClick={() => onPrefer(frame.id)}
              >
                {preferred ? 'Preferred' : 'Prefer'}
              </button>
            </li>
          )
        })}
      </ul>
      <div className="proto-lofi-actions">
        <button
          type="button"
          className="proto-lofi-handoff"
          disabled={!preferredFrameId}
          data-testid="proto-build-handoff"
          onClick={() => setPayloadShown((shown) => !shown)}
        >
          {payloadShown ? 'Hide handoff payload' : 'Preview handoff payload'}
        </button>
      </div>
      {payloadShown && payload ? (
        <pre className="proto-lofi-payload" data-testid="proto-handoff-payload">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : null}
    </aside>
  )
}
