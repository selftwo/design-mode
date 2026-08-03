import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

export type ThemeName = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'design-review-theme'

export function readStoredTheme(initial: ThemeName = 'light'): ThemeName {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'dark' ? 'dark' : initial
  } catch {
    return initial
  }
}

export function writeStoredTheme(theme: ThemeName): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // A blocked storage still leaves the in-memory toggle working.
  }
}

export function applyDocumentTheme(theme: ThemeName): void {
  document.documentElement.setAttribute('data-theme', theme)
}

// The reviewer’s theme choice survives reloads, same as collapsed panel state.
export function useThemeState(): [ThemeName, Dispatch<SetStateAction<ThemeName>>] {
  const [theme, setTheme] = useState<ThemeName>(() => readStoredTheme())

  useEffect(() => {
    applyDocumentTheme(theme)
    writeStoredTheme(theme)
  }, [theme])

  return [theme, setTheme]
}
