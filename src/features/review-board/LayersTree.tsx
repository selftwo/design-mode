import { useEffect, useRef } from 'react'
import type { LayersTreeRow, LayersTreeTarget } from './build-layers-tree'
import { layersTargetKey } from './build-layers-tree'

export function LayersTree({
  rows,
  selected,
  onSelect,
  onHover,
}: {
  rows: LayersTreeRow[]
  selected: LayersTreeTarget | null
  onSelect: (target: LayersTreeTarget) => void
  onHover: (target: LayersTreeTarget | null) => void
}) {
  const treeRef = useRef<HTMLDivElement>(null)
  const selectedKey = selected ? layersTargetKey(selected) : null

  useEffect(() => {
    const tree = treeRef.current
    if (!tree || !selectedKey) return
    const row = tree.querySelector<HTMLButtonElement>(`[data-tree-id="${selectedKey}"]`)
    if (!row) return
    tree.scrollTop = Math.max(0, row.offsetTop - tree.clientHeight / 2)
  }, [selectedKey, rows])

  return (
    <div ref={treeRef} className="dm-tree" role="listbox" aria-label="Layers tree">
      {rows.map((row) => {
        const rowKey = layersTargetKey(row.target)
        const className = [
          'dm-tree-row',
          row.frameRow ? 'dm-tree-row--frame' : '',
          row.markRow ? 'dm-tree-row--mark' : '',
          row.stale ? 'dm-tree-row--stale' : '',
        ].filter(Boolean).join(' ')
        return (
          <button
            key={row.id}
            type="button"
            className={className}
            style={{ '--lvl': row.level } as React.CSSProperties}
            data-tree-id={rowKey}
            aria-selected={selectedKey === rowKey}
            onClick={() => onSelect(row.target)}
            onMouseEnter={() => onHover(row.target)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(row.target)}
            onBlur={() => onHover(null)}
          >
            <span className="dm-tree-glyph" aria-hidden="true">{row.glyph}</span>
            {row.label}
            {row.meta ? <span className="dm-tree-meta">{row.meta}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
