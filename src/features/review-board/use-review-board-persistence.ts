import { useCallback, useState } from 'react'
import { boardsSemanticallyEqual } from './model/board-semantic-equality'
import { clearStoredBoard, saveBoard } from './model/board-local-storage'
import type { BoardDocument } from './model/board-document.schema'

// Where saved boards live. The browser default writes localStorage; the local
// host app persists through its HTTP API instead.
export interface BoardStorage {
  save: (document: BoardDocument) => void | Promise<void>
  clear: () => void
}

const localStorageBoardStorage: BoardStorage = {
  save: (document) => saveBoard(document),
  clear: () => clearStoredBoard(),
}

export function useReviewBoardPersistence(storage: BoardStorage = localStorageBoardStorage) {
  const [lastSaved, setLastSaved] = useState<BoardDocument | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const setBaseline = useCallback((baseline: BoardDocument) => {
    setLastSaved(baseline)
    setSaveStatus('idle')
    setSaveError(null)
    setResetError(null)
    setResetDialogOpen(false)
  }, [])

  const save = useCallback((document: BoardDocument) => {
    Promise.resolve()
      .then(() => storage.save(document))
      .then(() => {
        setLastSaved(document)
        setSaveStatus('saved')
        setSaveError(null)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Board could not be saved.'
        setSaveStatus('error')
        setSaveError(message)
      })
  }, [storage])

  const clearSaveError = useCallback(() => setSaveError(null), [])
  const clearResetError = useCallback(() => setResetError(null), [])

  // The board autosaves, so "unsaved changes" no longer gates the reset dialog:
  // reset confirmation compares against the board the host sent instead.
  const requestReset = useCallback((document: BoardDocument | null, baseline: BoardDocument | null) => {
    if (!document || !baseline) return
    setResetError(null)
    if (boardsSemanticallyEqual(document, baseline)) {
      return { immediate: true as const }
    }
    setResetDialogOpen(true)
    return { immediate: false as const }
  }, [])

  const cancelReset = useCallback(() => {
    setResetDialogOpen(false)
  }, [])

  const confirmReset = useCallback((hostBoard: BoardDocument): { ok: true; hostBoard: BoardDocument } | { ok: false; message: string } => {
    try {
      storage.clear()
      setResetDialogOpen(false)
      setResetError(null)
      setSaveStatus('idle')
      setSaveError(null)
      setLastSaved(hostBoard)
      return { ok: true, hostBoard }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stored board could not be cleared.'
      setResetError(message)
      return { ok: false, message }
    }
  }, [storage])

  const applyImmediateReset = useCallback((hostBoard: BoardDocument): { ok: true; hostBoard: BoardDocument } | { ok: false; message: string } => {
    try {
      storage.clear()
      setResetError(null)
      setSaveStatus('idle')
      setSaveError(null)
      setLastSaved(hostBoard)
      return { ok: true, hostBoard }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stored board could not be cleared.'
      setResetError(message)
      return { ok: false, message }
    }
  }, [storage])

  return {
    lastSaved,
    saveStatus,
    saveError,
    resetDialogOpen,
    resetError,
    setBaseline,
    save,
    clearSaveError,
    clearResetError,
    requestReset,
    cancelReset,
    confirmReset,
    applyImmediateReset,
  }
}
