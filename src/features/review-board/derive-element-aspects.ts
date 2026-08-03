import type { FrameElement, NormalizedPoint } from './model/board-document.schema'
import type { ElementAspects } from './model/element-aspects.schema'

function pixelBounds(
  bounds: readonly [NormalizedPoint, NormalizedPoint],
  viewport: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const [start, end] = bounds
  const x = Math.round(start[0] * viewport.width)
  const y = Math.round(start[1] * viewport.height)
  const width = Math.max(1, Math.round((end[0] - start[0]) * viewport.width))
  const height = Math.max(1, Math.round((end[1] - start[1]) * viewport.height))
  return { x, y, width, height }
}

// Host capture may omit aspects on older boards; derive readable CSS from bounds.
export function deriveElementAspects(
  element: FrameElement,
  viewport: { width: number; height: number },
): ElementAspects {
  if (element.aspects) return element.aspects
  const layout = { ...pixelBounds(element.bounds, viewport), rotation: 0 }
  const isHeading = /^h[1-6]$/.test(element.role) || element.role === 'heading'
  const isButton = element.role === 'button' || element.role === 'link'
  return {
    layout,
    flex: isButton ? undefined : {
      direction: 'column',
      gap: '8px',
      padding: '12px 12px',
      align: 'start',
    },
    radius: isButton ? '4px' : '6px',
    fills: [
      { name: isButton ? 'ink-strong' : 'card-bg', value: isButton ? '#1c1c1c' : '#ffffff' },
      { name: 'ink-soft', value: '#6f6f6f' },
    ],
    border: isButton ? undefined : {
      width: '1px',
      color: { name: 'hairline', value: '#e6e6e6' },
    },
    type: {
      sizeLeading: isHeading ? '20 / 26' : '14 / 20',
      family: 'system-ui',
      weight: isHeading || isButton ? '650' : '400',
    },
  }
}
