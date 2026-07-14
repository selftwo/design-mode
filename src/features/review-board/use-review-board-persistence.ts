import { useCallback, useState } from 'react'
import { boardsSemanticallyEqual } from './model/board-semantic-equality'
import { clearStoredBoard, saveBoard } from './model/board-local-storage'
import type { BoardDocument } from './model/board-document.schema'

export function useReviewBoardPersistence() {
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
    try {
      saveBoard(document)
      setLastSaved(document)
      setSaveStatus('saved')
      setSaveError(null)
      window.setTimeout(() => setSaveStatus('idle'), 1200)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Board could not be saved.'
      setSaveStatus('error')
      setSaveError(message)
    }
  }, [])

  const requestReset = useCallback((document: BoardDocument | null) => {
    if (!document || !lastSaved) return
    setResetError(null)
    if (boardsSemanticallyEqual(document, lastSaved)) {
      return { immediate: true as const }
    }
    setResetDialogOpen(true)
    return { immediate: false as const }
  }, [lastSaved])

  const cancelReset = useCallback(() => {
    setResetDialogOpen(false)
  }, [])

  const confirmReset = useCallback((hostBoard: BoardDocument): { ok: true; hostBoard: BoardDocument } | { ok: false; message: string } => {
    try {
      clearStoredBoard()
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
  }, [])

  const applyImmediateReset = useCallback((hostBoard: BoardDocument): { ok: true; hostBoard: BoardDocument } | { ok: false; message: string } => {
    try {
      clearStoredBoard()
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
  }, [])

  return {
    lastSaved,
    saveStatus,
    saveError,
    resetDialogOpen,
    resetError,
    setBaseline,
    save,
    requestReset,
    cancelReset,
    confirmReset,
    applyImmediateReset,
  }
}