import type { EngineName, ToolMode } from './model/board-document.schema'

export function ReviewToolbar({
  engine,
  tool,
  focused,
  onTool,
  onSave,
  onReset,
  onExport,
  onFocusSelected,
  onExitFocus,
}: {
  engine: EngineName
  tool: ToolMode
  focused: boolean
  onTool: (tool: ToolMode) => void
  onSave: () => void
  onReset: () => void
  onExport: () => void
  onFocusSelected: () => void
  onExitFocus: () => void
}) {
  return (
    <header className="toolbar">
      <strong>Canvas pressure test</strong>
      <span className="engine-badge" data-testid="engine-name">{engine}</span>
      <nav aria-label="Review tools">
        {(['select', 'circle', 'comment'] as const).map((name) => (
          <button
            type="button"
            key={name}
            className={tool === name ? 'active' : ''}
            aria-pressed={tool === name}
            onClick={() => onTool(name)}
            data-testid={`tool-${name}`}
          >
            {name}
          </button>
        ))}
      </nav>
      <div className="toolbar-actions">
        <button type="button" onClick={onSave} data-testid="save-board">Save</button>
        <button type="button" onClick={onReset} data-testid="reset-board">Reset</button>
        <button type="button" onClick={onExport} data-testid="export-annotation">Export</button>
        {focused ? (
          <button type="button" onClick={onExitFocus} data-testid="exit-focus">Exit live</button>
        ) : (
          <button type="button" onClick={onFocusSelected} data-testid="focus-selected">Focus selected</button>
        )}
      </div>
    </header>
  )
}
