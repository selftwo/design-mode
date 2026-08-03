import { useRef, type ReactNode } from 'react'
import { ToolModeSchema, type EngineName, type ToolMode } from './model/board-document.schema'
import { useThemeState } from './use-theme-state'

const TOOL_LABELS: Record<ToolMode, string> = {
  select: 'Select',
  circle: 'Circle',
  comment: 'Comment',
}

export function ReviewToolbar({
  engine,
  tool,
  learnLensOpen,
  focused,
  canFocus,
  onTool,
  onToggleLearnLens,
  onReset,
  onFocusSelected,
  onExitFocus,
  onImportImages,
  boardLabel,
  children,
}: {
  engine: EngineName
  tool: ToolMode
  learnLensOpen: boolean
  focused: boolean
  canFocus: boolean
  onTool: (tool: ToolMode) => void
  onToggleLearnLens: () => void
  onReset: () => void
  onFocusSelected: () => void
  onExitFocus: () => void
  onImportImages: (files: File[]) => void
  boardLabel: string
  children?: ReactNode
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useThemeState()
  const isDark = theme === 'dark'
  const showDeveloperChrome = new URLSearchParams(window.location.search).get('dev') === '1'
  return (
    <header className="toolbar-island dm-island dm-toolbar" aria-label="Tools">
      <span className="dm-toolbar-title">Design review canvas</span>
      <span className="dm-badge board-name-pill" data-testid="board-name-pill">▦ {boardLabel}</span>
      {showDeveloperChrome ? <span className="dm-badge" data-tone="muted" data-testid="engine-name">{engine}</span> : null}
      <div className="dm-toolbar-group" role="group" aria-label="Review tools">
        {ToolModeSchema.options.map((name) => (
          <button
            type="button"
            key={name}
            className="dm-btn dm-btn--quiet dm-btn--sm"
            aria-pressed={tool === name}
            aria-label={`${name} tool`}
            title={`${name.charAt(0).toUpperCase()}${name.slice(1)}`}
            onClick={() => onTool(name)}
            data-testid={`tool-${name}`}
          >
            {TOOL_LABELS[name]}
          </button>
        ))}
        <button
          type="button"
          className="dm-btn dm-btn--quiet dm-btn--sm"
          aria-pressed={learnLensOpen}
          aria-label="Learn tool"
          title="Learn"
          data-testid="tool-learn"
          onClick={onToggleLearnLens}
        >
          Learn
        </button>
      </div>
      {children}
      <div className="dm-toolbar-spacer" />
      <div className="dm-toolbar-group toolbar-actions">
        <button
          type="button"
          className="dm-btn dm-btn--quiet dm-btn--sm"
          data-testid="theme-toggle"
          aria-pressed={isDark}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
          {isDark ? 'Light' : 'Dark'}
        </button>
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
        <button
          type="button"
          className="dm-btn dm-btn--sm"
          onClick={() => fileInputRef.current?.click()}
          data-testid="import-images"
        >
          Import
        </button>
        {focused ? (
          <button
            type="button"
            className="dm-btn dm-btn--quiet dm-btn--sm"
            aria-pressed="true"
            onClick={onExitFocus}
            data-testid="exit-focus"
          >
            <span className="live-dot" aria-hidden="true" />
            Live
          </button>
        ) : (
          <button
            type="button"
            className="dm-btn dm-btn--quiet dm-btn--sm"
            aria-pressed="false"
            onClick={onFocusSelected}
            disabled={!canFocus}
            data-testid="focus-selected"
          >
            <span className="live-dot" aria-hidden="true" />
            Live
          </button>
        )}
        <button type="button" className="dm-btn dm-btn--quiet dm-btn--sm" onClick={onReset} data-testid="reset-board">Reset</button>
      </div>
    </header>
  )
}
