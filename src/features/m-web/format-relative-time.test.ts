import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './format-relative-time'

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-07-17T12:00:00.000Z')

  it('returns now for timestamps under one minute old', () => {
    expect(formatRelativeTime('2026-07-17T11:59:30.000Z', now)).toBe('now')
  })

  it('returns minutes, hours, and days', () => {
    expect(formatRelativeTime('2026-07-17T11:58:00.000Z', now)).toBe('2m')
    expect(formatRelativeTime('2026-07-17T10:00:00.000Z', now)).toBe('2h')
    expect(formatRelativeTime('2026-07-15T12:00:00.000Z', now)).toBe('2d')
  })
})
