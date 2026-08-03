import { describe, expect, it } from 'vitest'
import { buildMWebHref, parseMWebRoute } from './MWebApp'

describe('parseMWebRoute', () => {
  it('parses boards, capture, runs, and notices routes', () => {
    expect(parseMWebRoute('#/boards')).toEqual({ page: 'boards' })
    expect(parseMWebRoute('#/notices')).toEqual({ page: 'notices' })
    expect(parseMWebRoute('#/projects/p1/capture?frame=f1&annotation=a1')).toEqual({
      page: 'capture',
      projectId: 'p1',
      frameId: 'f1',
      annotationId: 'a1',
    })
    expect(parseMWebRoute('#/projects/p1/runs')).toEqual({ page: 'runs', projectId: 'p1' })
  })

  it('builds hash links for navigation', () => {
    expect(buildMWebHref({ page: 'boards' })).toBe('#/boards')
    expect(buildMWebHref({
      page: 'capture',
      projectId: 'p1',
      frameId: 'f1',
      annotationId: 'a1',
    })).toBe('#/projects/p1/capture?frame=f1&annotation=a1')
  })
})
