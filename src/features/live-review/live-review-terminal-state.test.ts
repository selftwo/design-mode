import { describe, expect, it } from 'vitest'
import { createLiveReviewTerminalGuard } from './live-review-terminal-state'

describe('createLiveReviewTerminalGuard', () => {
  it('keeps unavailable terminal when ready arrives late', () => {
    const guard = createLiveReviewTerminalGuard()
    expect(guard.markUnavailable()).toBe(true)
    expect(guard.getState()).toBe('unavailable')
    expect(guard.markReady()).toBe(false)
    expect(guard.getState()).toBe('unavailable')
  })

  it('stops further transitions after ready', () => {
    const guard = createLiveReviewTerminalGuard()
    expect(guard.markReady()).toBe(true)
    expect(guard.markUnavailable()).toBe(false)
    expect(guard.getState()).toBe('ready')
  })
})