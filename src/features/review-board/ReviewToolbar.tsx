import { useRef, type ReactNode } from 'react'
import { ToolModeSchema, type EngineName, type ToolMode } from './model/board-document.schema'

const TOOL_ICONS: Record<ToolMode, ReactNode> = {
  select: (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M4.3 1.9 12 8.9l-3.8.5 2 4.1-1.9.9-2-4.1-2 2.1z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  ),
  circle: (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <ellipse cx="8" cy="8" rx="5.7" ry="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  comment: (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M3 2.8h10a1.2 1.2 0 0 1 1.2 1.2v6a1.2 1.2 0 0 1-1.2 1.2H8.4l-3.2 2.9v-2.9H3A1.2 1.2 0 0 1 1.8 10V4A1.2 1.2 0 0 1 3 2.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

export function ReviewToolbar({
  engine,
  tool,
  focused,
  canFocus,
  onTool,
  onReset,
  onFocusSelected,
  onExitFocus,
  onImportImages,
  children,
}: {
  engine: EngineName
  tool: ToolMode
  focused: boolean
  canFocus: boolean
  onTool: (tool: ToolMode) => void
  onReset: () => void
  onFocusSelected: () => void
  onExitFocus: () => void
  onImportImages: (files: File[]) => void
  children?: ReactNode
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  return (
    <header className="toolbar">
      <strong>Design review canvas</strong>
      <span className="engine-badge" data-testid="engine-name">{engine}</span>
      <nav aria-label="Review tools">
        {ToolModeSchema.options.map((name) => (
          <button
            type="button"
            key={name}
            className={`tool-button ${tool === name ? 'active' : ''}`}
            aria-pressed={tool === name}
            aria-label={`${name} tool`}
            title={`${name.charAt(0).toUpperCase()}${name.slice(1)}`}
            onClick={() => onTool(name)}
            data-testid={`tool-${name}`}
          >
            {TOOL_ICONS[name]}
          </button>
        ))}
      </nav>
      {children}
      <div className="toolbar-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          data-testid="import-images-input"
          onChange={(event) => {
            onImportImages([...(event.target.files ?? [])])
            event.target.value = ''
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} data-testid="import-images">
          Import images
        </button>
        <button type="button" onClick={onReset} data-testid="reset-board">Reset</button>
        {focused ? (
          <button type="button" onClick={onExitFocus} data-testid="exit-focus">Exit live view</button>
        ) : (
          <button type="button" onClick={onFocusSelected} disabled={!canFocus} data-testid="focus-selected">
            Open live view
          </button>
        )}
      </div>
    </header>
  )
}
