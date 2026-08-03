import { describe, expect, it } from 'vitest'
import { deriveElementAspects } from './derive-element-aspects'

describe('deriveElementAspects', () => {
  it('returns captured aspects when the element already carries them', () => {
    const aspects = deriveElementAspects({
      id: 'el-1',
      label: 'plan-keep',
      role: 'button',
      bounds: [[0.1, 0.1], [0.4, 0.4]],
      aspects: {
        layout: { x: 10, y: 20, width: 120, height: 48, rotation: 0 },
        radius: '6px',
        fills: [{ name: 'card-bg', value: '#ffffff' }],
        type: { sizeLeading: '14 / 20', family: 'Inter', weight: '650' },
      },
    }, { width: 800, height: 600 })

    expect(aspects.fills[0]?.name).toBe('card-bg')
    expect(aspects.layout.width).toBe(120)
  })

  it('derives readable CSS aspects from bounds when capture omitted them', () => {
    const aspects = deriveElementAspects({
      id: 'el-2',
      label: 'Hero title',
      role: 'h1',
      bounds: [[0.2, 0.1], [0.8, 0.2]],
    }, { width: 1000, height: 800 })

    expect(aspects.layout).toMatchObject({ x: 200, y: 80, width: 600, height: 80 })
    expect(aspects.fills.some((fill) => fill.name === 'card-bg')).toBe(true)
    expect(aspects.type?.sizeLeading).toBe('20 / 26')
  })
})
