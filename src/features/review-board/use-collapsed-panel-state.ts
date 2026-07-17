import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

export function readStoredCollapse(storageKey: string, initial: boolean): boolean {
  try {
    const stored = window.localStorage.getItem(storageKey)
    return stored === null ? initial : stored === 'true'
  } catch {
    return initial
  }
}

export function writeStoredCollapse(storageKey: string, collapsed: boolean): void {
  try {
    window.localStorage.setItem(storageKey, String(collapsed))
  } catch {
    // A blocked storage still leaves the in-memory toggle working.
  }
}

// Side panes remember whether the reviewer tucked them away, per browser,
// so the board layout survives reloads.
export function useCollapsedPanelState(
  storageKey: string,
  initial: boolean,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [collapsed, setCollapsed] = useState(() => readStoredCollapse(storageKey, initial))

  useEffect(() => {
    writeStoredCollapse(storageKey, collapsed)
  }, [storageKey, collapsed])

  return [collapsed, setCollapsed]
}
