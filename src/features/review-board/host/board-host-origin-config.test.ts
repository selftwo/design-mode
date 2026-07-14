import { describe, expect, it } from 'vitest'
import { readAllowedBoardHostOrigins } from './board-host-origin-config'

describe('board host origin config', () => {
  it('allows the canvas origin by default', () => {
    expect(readAllowedBoardHostOrigins({
      origin: 'http://canvas.test',
      search: '?engine=reactflow',
    })).toEqual(['http://canvas.test'])
  })

  it('adds configured HTTP host origins without duplicates', () => {
    expect(readAllowedBoardHostOrigins({
      origin: 'http://canvas.test',
      search: '?hostOrigin=https%3A%2F%2Fhost.test%2Fpath&hostOrigin=http%3A%2F%2Fcanvas.test',
    })).toEqual(['http://canvas.test', 'https://host.test'])
  })

  it('ignores invalid and opaque host origins', () => {
    expect(readAllowedBoardHostOrigins({
      origin: 'http://canvas.test',
      search: '?hostOrigin=not-a-url&hostOrigin=data%3Atext%2Fplain%2Chi',
    })).toEqual(['http://canvas.test'])
  })
})
