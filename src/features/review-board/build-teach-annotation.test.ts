import { describe, expect, it } from 'vitest'
import { buildTeachAnnotation } from './build-teach-annotation'
import { BOARD_SCHEMA_VERSION } from './model/board-document.schema'

const frame = {
  id: 'frame-1',
  label: 'Pricing',
  route: '/pricing',
  viewport: { width: 800, height: 600 },
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  aspectRatio: 4 / 3,
  screenshotPath: 'screens/pricing.svg',
  screenshotDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
  refreshedScreenshotDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
    captureHash: 'capture-1',
    revision: 1,
    elements: [],
    kind: 'captured-route' as const,
    lifeState: 'active' as const,
}

const element = {
  id: 'plan-keep',
  label: 'plan-keep',
  role: 'group',
  bounds: [[0.58, 0.18], [0.94, 0.88]] as [[number, number], [number, number]],
}

describe('buildTeachAnnotation', () => {
  it('anchors a teach note on the picked element with machine provenance', () => {
    const annotation = buildTeachAnnotation({
      frame,
      element,
      question: 'Why heavier?',
      answer: 'The filled button carries the weight.',
      provenanceRunId: 'run-142',
    })
    expect(annotation).toMatchObject({
      kind: 'teach',
      frameId: 'frame-1',
      instruction: 'The filled button carries the weight.',
      question: 'Why heavier?',
      provenanceRunId: 'run-142',
      mark: {
        kind: 'element',
        elementId: 'plan-keep',
        label: 'plan-keep',
      },
      madeAgainstCaptureHash: 'capture-1',
      madeAgainstRevision: 1,
    })
    expect(annotation.anchor[0]).toBeCloseTo(0.76)
    expect(annotation.anchor[1]).toBeCloseTo(0.53)
  })

  it('round trips through the board document schema', async () => {
    const { BoardDocumentSchema } = await import('./model/board-document.schema')
    const annotation = buildTeachAnnotation({
      frame,
      element,
      question: 'Why heavier?',
      answer: 'The filled button carries the weight.',
      provenanceRunId: 'run-142',
    })
    const document = BoardDocumentSchema.parse({
      schemaVersion: BOARD_SCHEMA_VERSION,
      boardId: 'board-1',
      documentRevision: 1,
      camera: { worldX: 0, worldY: 0, zoom: 1 },
      frames: [frame],
      annotations: [annotation],
      units: [],
      zones: [],
      verdicts: [],
      reviewSummaries: [],
    })
    expect(document.annotations[0]?.kind).toBe('teach')
  })
})
