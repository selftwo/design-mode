import { describe, expect, it } from 'vitest'
import { parseRouteLines } from './HostProjectPicker'

describe('parseRouteLines', () => {
  it('turns one line per route into capture routes with stable ids', () => {
    const routes = parseRouteLines('/ Home\n/pricing Pricing page\n\nnot-a-route\n/settings')
    expect(routes).toEqual([
      { id: 'root', label: 'Home', path: '/' },
      { id: 'pricing', label: 'Pricing page', path: '/pricing' },
      { id: 'settings', label: '/settings', path: '/settings' },
    ])
  })

  it('returns nothing when no line starts with a slash', () => {
    expect(parseRouteLines('home\npricing')).toEqual([])
  })
})
