import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readStoredCollapse, writeStoredCollapse } from './use-collapsed-panel-state'

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('collapsed panel storage', () => {
  it('falls back to the initial value when nothing is stored', () => {
    expect(readStoredCollapse('pane-a', true)).toBe(true)
    expect(readStoredCollapse('pane-a', false)).toBe(false)
  })

  it('remembers the last choice per pane key', () => {
    writeStoredCollapse('pane-a', false)
    writeStoredCollapse('pane-b', true)
    expect(readStoredCollapse('pane-a', true)).toBe(false)
    expect(readStoredCollapse('pane-b', false)).toBe(true)
  })

  it('falls back to the initial value when storage is blocked', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('blocked')
      },
    })
    expect(readStoredCollapse('pane-a', true)).toBe(true)
    expect(() => writeStoredCollapse('pane-a', false)).not.toThrow()
  })
})
