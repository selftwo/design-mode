import { useLayoutEffect, useMemo, useState } from 'react'
import type { LocalHostClient } from '@/features/local-host/local-host-client'
import { BoardAspectsPanel } from './BoardAspectsPanel'
import {
  buildLayersTreeRows,
  resolveLayersSelection,
  type LayersTreeTarget,
} from './build-layers-tree'
import { DesignContextInIsland } from './DesignContextInIsland'
import { ElementAspectsPanel } from './ElementAspectsPanel'
import { FrameAspectsPanel } from './FrameAspectsPanel'
import { LayersTree } from './LayersTree'
import type { BoardDocument } from './model/board-document.schema'
import { readSelectionBounds } from './read-selection-bounds'
import { SummonedIsland } from './SummonedIsland'
import type { Rect } from './island-placement'
import './LayersAndAspectsIsland.css'

function aspectsHeading(selection: LayersTreeTarget | null): string | null {
  if (!selection || selection.kind === 'board') return 'Board'
  if (selection.kind === 'frame') return 'Frame'
  if (selection.kind === 'element') return 'Element'
  if (selection.kind === 'annotation') return 'Annotation'
  return null
}

export function LayersAndAspectsIsland({
  document,
  boardLabel,
  captureSource,
  boardSelected,
  selectedFrameId,
  selectedElementId,
  selectedAnnotationId,
  hoveredTarget,
  contextClient,
  onSelectTarget,
  onHoverTarget,
  onDismiss,
}: {
  document: BoardDocument
  boardLabel: string
  captureSource: string | null
  boardSelected: boolean
  selectedFrameId: string | null
  selectedElementId: string | null
  selectedAnnotationId: string | null
  hoveredTarget: LayersTreeTarget | null
  contextClient: LocalHostClient | null
  onSelectTarget: (target: LayersTreeTarget) => void
  onHoverTarget: (target: LayersTreeTarget | null) => void
  onDismiss: () => void
}) {
  const selection = resolveLayersSelection(
    document,
    selectedFrameId,
    selectedElementId,
    selectedAnnotationId,
    boardSelected,
  )
  const open = selection !== null
  const rows = useMemo(() => buildLayersTreeRows(document, boardLabel), [boardLabel, document])
  const [selectionBounds, setSelectionBounds] = useState<Rect | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setSelectionBounds(null)
      return
    }
    let cancelled = false
    let outerFrame = 0
    let innerFrame = 0
    const read = () => {
      if (cancelled) return
      const rect = readSelectionBounds(selectedFrameId, selectedElementId, selectedAnnotationId)
      if (!rect) {
        setSelectionBounds(null)
        return
      }
      setSelectionBounds({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      })
    }
    outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(read)
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(outerFrame)
      window.cancelAnimationFrame(innerFrame)
    }
  }, [open, selectedAnnotationId, selectedElementId, selectedFrameId])

  const selectedFrame = selectedFrameId
    ? document.frames.find((frame) => frame.id === selectedFrameId) ?? null
    : null
  const selectedElement = selectedFrame && selectedElementId
    ? selectedFrame.elements.find((element) => element.id === selectedElementId) ?? null
    : null
  const aspectsLabel = aspectsHeading(selection)

  return (
    <SummonedIsland
      open={open}
      selectionBounds={selectionBounds}
      ariaLabel="Layers and aspects"
      title={boardLabel}
      testId="summoned-inspector-island"
      className="layers-aspects-island"
      onDismiss={onDismiss}
    >
      <div className="dm-sect">Layers</div>
      <LayersTree
        rows={rows}
        selected={selection}
        onSelect={onSelectTarget}
        onHover={onHoverTarget}
      />
      {aspectsLabel ? (
        <>
          <div className="dm-sect">Aspects · {aspectsLabel.toLowerCase()}</div>
          {selection?.kind === 'board' ? (
            <BoardAspectsPanel
              document={document}
              boardLabel={boardLabel}
              captureSource={captureSource}
            />
          ) : null}
          {selection?.kind === 'frame' && selectedFrame ? (
            <FrameAspectsPanel frame={selectedFrame} />
          ) : null}
          {selection?.kind === 'element' && selectedFrame && selectedElement ? (
            <ElementAspectsPanel element={selectedElement} frame={selectedFrame} />
          ) : null}
          {selection?.kind === 'annotation' && selectedAnnotationId ? (
            <div className="layers-aspects-scroll" data-testid="annotation-aspects-panel">
              <div className="dm-arow">
                <span className="dm-alabel">Annotation</span>
                <span className="dm-aval dm-mono">{selectedAnnotationId}</span>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {contextClient ? <DesignContextInIsland client={contextClient} /> : null}
      {hoveredTarget ? (
        <span className="visually-hidden" data-testid="layers-hover-target">
          {hoveredTarget.kind}
        </span>
      ) : null}
    </SummonedIsland>
  )
}
