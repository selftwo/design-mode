import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readStoredTheme, writeStoredTheme } from './use-theme-state'

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

describe('theme storage', () => {
  it('defaults to light when nothing is stored', () => {
    expect(readStoredTheme()).toBe('light')
  })

  it('restores dark when that was the last choice', () => {
    writeStoredTheme('dark')
    expect(readStoredTheme()).toBe('dark')
  })

  it('falls back to light when storage is blocked', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('blocked')
      },
    })
    expect(readStoredTheme()).toBe('light')
    expect(() => writeStoredTheme('dark')).not.toThrow()
  })
})
