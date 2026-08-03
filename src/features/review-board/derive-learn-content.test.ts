import { describe, expect, it } from 'vitest'
import { deriveLearnContent } from './derive-learn-content'
import type { FrameElement, ScreenFrame } from './model/board-document.schema'

function frame(elements: FrameElement[]): ScreenFrame {
  return {
    id: 'pricing',
    label: 'Pricing',
    route: '/pricing',
    viewport: { width: 800, height: 600 },
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    aspectRatio: 4 / 3,
    screenshotPath: 'screens/pricing.png',
    screenshotDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
    refreshedScreenshotDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
    captureHash: 'pricing-hash',
    revision: 1,
    elements,
  }
}

describe('deriveLearnContent', () => {
  it('names a solid button as a signal', () => {
    const element: FrameElement = {
      id: 'plan-keep',
      label: 'plan-keep',
      role: 'button',
      bounds: [[0.5, 0.5], [0.8, 0.7]],
    }
    const content = deriveLearnContent(element, frame([element]))
    expect(content.vocabularyTerm).toBe('signal')
    expect(content.anatomy).toContain('solid fill')
    expect(content.whyLine.length).toBeGreaterThan(10)
  })

  it('describes a bordered flex region as a card', () => {
    const element: FrameElement = {
      id: 'plan-free',
      label: 'plan-free',
      role: 'group',
      bounds: [[0.1, 0.4], [0.4, 0.9]],
      aspects: {
        layout: { x: 40, y: 120, width: 120, height: 180, rotation: 0 },
        flex: { direction: 'column', gap: '8px', padding: '12px 12px', align: 'start' },
        radius: '6px',
        fills: [{ name: 'card-bg', value: '#ffffff' }],
        border: { width: '1px', color: { name: 'hairline', value: '#e6e6e6' } },
      },
    }
    const content = deriveLearnContent(element, frame([element]))
    expect(content.vocabularyTerm).toBe('card')
    expect(content.anatomy).toContain('flex column')
  })
})
