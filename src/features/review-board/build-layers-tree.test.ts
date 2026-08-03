import { describe, expect, it } from 'vitest'
import { BOARD_SCHEMA_VERSION, type BoardDocument } from './model/board-document.schema'
import { buildLayersTreeRows, resolveLayersSelection } from './build-layers-tree'

describe('buildLayersTreeRows', () => {
  const document: BoardDocument = {
    schemaVersion: BOARD_SCHEMA_VERSION,
    boardId: 'demo-board',
    camera: { worldX: 0, worldY: 0, zoom: 1 },
    frames: [{
      id: 'frame-1',
      label: 'Pricing',
      route: '/pricing',
      viewport: { width: 1440, height: 900 },
      x: 0,
      y: 0,
      width: 400,
      height: 250,
      aspectRatio: 16 / 9,
      screenshotPath: 'pricing.png',
      screenshotDataUrl: 'data:image/png;base64,',
      refreshedScreenshotDataUrl: 'data:image/png;base64,',
      captureHash: 'hash-1',
      revision: 1,
      elements: [{
        id: 'frame-1-el-1',
        label: 'plan-keep',
        role: 'button',
        bounds: [[0.2, 0.2], [0.8, 0.8]] as [[number, number], [number, number]],
      }],
    }],
    annotations: [{
      kind: 'review',
      id: 'ann-1',
      frameId: 'frame-1',
      status: 'draft' as const,
      instruction: '',
      anchor: [0.5, 0.5] as [number, number],
      mark: {
        kind: 'element' as const,
        elementId: 'frame-1-el-1',
        label: 'plan-keep',
        points: [[0.2, 0.2], [0.8, 0.8]] as [[number, number], [number, number]],
      },
      createdAt: new Date().toISOString(),
      madeAgainstCaptureHash: 'hash-1',
      madeAgainstRevision: 1,
    }],
  }

  it('lists board, frame, element, and mark rows in hierarchy order', () => {
    const rows = buildLayersTreeRows(document, 'landing review')
    expect(rows.map((row) => row.label)).toEqual([
      'landing review',
      'Pricing',
      'plan-keep',
      '#1 element',
    ])
    expect(rows.at(-1)?.markRow).toBe(true)
  })

  it('resolves the active layers selection from app selection state', () => {
    expect(resolveLayersSelection(document, null, null, 'ann-1', false)).toEqual({
      kind: 'annotation',
      annotationId: 'ann-1',
    })
    expect(resolveLayersSelection(document, 'frame-1', 'frame-1-el-1', null, false)).toEqual({
      kind: 'element',
      frameId: 'frame-1',
      elementId: 'frame-1-el-1',
    })
    expect(resolveLayersSelection(document, null, null, null, true)).toEqual({ kind: 'board' })
  })

  it('lists teach annotations with the provenance glyph in the tree', () => {
    const teachDocument: BoardDocument = {
      ...document,
      annotations: [{
        kind: 'teach',
        id: 'teach-1',
        frameId: 'frame-1',
        status: 'draft',
        instruction: 'The filled button carries the weight.',
        question: 'Why heavier?',
        provenanceRunId: 'run-142',
        anchor: [0.5, 0.5],
        mark: {
          kind: 'element',
          elementId: 'frame-1-el-1',
          label: 'plan-keep',
          points: [[0.2, 0.2], [0.8, 0.8]],
        },
        createdAt: new Date().toISOString(),
        madeAgainstCaptureHash: 'hash-1',
        madeAgainstRevision: 1,
      }],
    }
    const rows = buildLayersTreeRows(teachDocument, 'landing review')
    const teachRow = rows.find((row) => row.id === 'annotation:teach-1')
    expect(teachRow?.glyph).toBe('⌁')
    expect(teachRow?.meta).toBe('teach')
    expect(teachRow?.label).toBe('#1 teach')
  })
})
