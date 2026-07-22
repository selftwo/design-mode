import { memo } from 'react'
import { type Node, type NodeProps } from '@xyflow/react'
import type { BoardZone, ScreenFrame } from '../../model/board-document.schema'
import './BoardZoneNode.css'

export interface BoardZoneNodeData extends Record<string, unknown> {
  zone: BoardZone
  memberFrames: ScreenFrame[]
  onToggleCollapsed: (zoneId: string) => void
}

function zoneKindClass(kind: BoardZone['kind']): string {
  return kind === 'archive' ? 'zone-archive' : 'zone-killed'
}

function collapseLabel(collapsed: boolean): string {
  return collapsed ? 'Expand zone' : 'Collapse zone'
}

function collapseGlyph(collapsed: boolean): string {
  return collapsed ? '▸' : '▾'
}

export const BoardZoneNode = memo(function BoardZoneNode({
  data: node,
}: NodeProps<Node<BoardZoneNodeData>>) {
  const { zone, memberFrames, onToggleCollapsed } = node
  const kindClass = zoneKindClass(zone.kind)

  const header = (
    <>
      <span className="board-zone-label">{zone.label}</span>
      {!zone.collapsed ? (
        <span className="board-zone-count">
          {memberFrames.length} {memberFrames.length === 1 ? 'frame' : 'frames'}
        </span>
      ) : null}
      <button
        type="button"
        className="board-zone-collapse nodrag nopan"
        data-testid={`zone-collapse-${zone.id}`}
        aria-expanded={!zone.collapsed}
        aria-label={collapseLabel(zone.collapsed)}
        title={collapseLabel(zone.collapsed)}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onToggleCollapsed(zone.id)
        }}
      >
        {collapseGlyph(zone.collapsed)}
      </button>
    </>
  )

  if (zone.collapsed) {
    return (
      <div
        className={`board-zone-node board-zone-node--collapsed ${kindClass}`}
        style={{ width: zone.width, height: zone.height }}
        data-testid={`zone-${zone.id}`}
      >
        <div className="board-zone-header">{header}</div>
        <div className="board-zone-thumbs" data-testid={`zone-thumbs-${zone.id}`}>
          {memberFrames.map((frame) => (
            <img
              key={frame.id}
              className="board-zone-thumb"
              src={frame.screenshotDataUrl}
              alt={frame.label}
              draggable={false}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`board-zone-node board-zone-node--expanded ${kindClass}`}
      style={{ width: zone.width, height: zone.height }}
      data-testid={`zone-${zone.id}`}
    >
      <div className="board-zone-header">{header}</div>
      <div className="board-zone-body" aria-hidden />
    </div>
  )
})
