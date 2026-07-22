import { useCallback, useRef, useState } from 'react'
import { boardsSemanticallyEqual } from './model/board-semantic-equality'
import { clearStoredBoard, saveBoard } from './model/board-local-storage'
import { createBoardSaveQueue } from './board-save-queue'
import type { BoardDocument } from './model/board-document.schema'

// Where saved boards live. The browser default writes localStorage; the local
// host app persists through its HTTP compare-and-save API instead.
export interface BoardStorage {
  save: (input: { board: BoardDocument; baseRevision: number }) => BoardDocument | Promise<BoardDocument>
  clear: () => void | Promise<void>
}

// The result of an awaited immediate save, so a caller (generation) can gate on
// the board actually reaching the host before it acts.
export type ImmediateSaveResult =
  | { ok: true; board: BoardDocument }
  | { ok: false; error: string; conflict?: true }

const localStorageBoardStorage: BoardStorage = {
  save: ({ board }) => {
    saveBoard(board)
    return board
  },
  clear: () => clearStoredBoard(),
}

function isBoardRevisionConflict(error: unknown): error is Error & {
  documentRevision: number
  board: BoardDocument
} {
  if (!(error instanceof Error) || error.name !== 'BoardRevisionConflictError') return false
  const candidate = error as Error & { documentRevision?: unknown; board?: unknown }
  return typeof candidate.documentRevision === 'number'
    && typeof candidate.board === 'object'
    && candidate.board !== null
}

export function useReviewBoardPersistence(storage: BoardStorage = localStorageBoardStorage) {
  const [lastSaved, setLastSaved] = useState<BoardDocument | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  // Autosave and immediate save share one serial queue so an older PUT can never
  // land after a newer one. `storageRef` keeps the queue's write pointed at the
  // current storage without recreating the queue. `revisionRef` is the last
  // host-acknowledged documentRevision, read at job execution time so chained
  // saves see the revision from the previous success.
  const storageRef = useRef(storage)
  storageRef.current = storage
  const revisionRef = useRef(0)
  const queueRef = useRef<ReturnType<typeof createBoardSaveQueue> | null>(null)
  if (!queueRef.current) {
    queueRef.current = createBoardSaveQueue(async (document) => {
      const saved = await storageRef.current.save({
        board: document,
        baseRevision: revisionRef.current,
      })
      revisionRef.current = saved.documentRevision
      return saved
    })
  }
  // Bumped whenever a new baseline is established (host load or reset). A save
  // that began before the bump must not overwrite the newer in-memory baseline
  // when it finally settles. `saveSeq` keeps only the newest save owning status.
  const baselineEpochRef = useRef(0)
  const saveSeqRef = useRef(0)

  const runSave = useCallback((document: BoardDocument): Promise<ImmediateSaveResult> => {
    const epoch = baselineEpochRef.current
    const seq = (saveSeqRef.current += 1)
    return queueRef.current!.enqueue(document).then(
      (saved) => {
        if (baselineEpochRef.current === epoch) setLastSaved(saved)
        if (saveSeqRef.current === seq) {
          setSaveStatus('saved')
          setSaveError(null)
        }
        return { ok: true, board: saved } as const
      },
      (error: unknown) => {
        if (isBoardRevisionConflict(error)) {
          revisionRef.current = error.documentRevision
          if (baselineEpochRef.current === epoch) setLastSaved(error.board)
          const message = 'The board changed on the server. Your edits are still here; save again to publish.'
          if (saveSeqRef.current === seq) {
            setSaveStatus('error')
            setSaveError(message)
          }
          return { ok: false, error: message, conflict: true } as const
        }
        const message = error instanceof Error ? error.message : 'Board could not be saved.'
        if (saveSeqRef.current === seq) {
          setSaveStatus('error')
          setSaveError(message)
        }
        return { ok: false, error: message } as const
      },
    )
  }, [])

  const setBaseline = useCallback((baseline: BoardDocument) => {
    baselineEpochRef.current += 1
    revisionRef.current = baseline.documentRevision
    setLastSaved(baseline)
    setSaveStatus('idle')
    setSaveError(null)
    setResetError(null)
    setResetDialogOpen(false)
  }, [])

  // Host agent patches: advance the acknowledged revision and fold the same
  // agent records into lastSaved so they do not look like local dirty edits.
  const acknowledgeBoardPatch = useCallback((
    patchRevision: number,
    mergeInto: (board: BoardDocument) => BoardDocument,
  ) => {
    revisionRef.current = Math.max(revisionRef.current, patchRevision)
    setLastSaved((current) => {
      if (!current) return current
      const merged = mergeInto(current)
      return { ...merged, documentRevision: Math.max(merged.documentRevision, patchRevision) }
    })
  }, [])

  const save = useCallback((document: BoardDocument) => {
    void runSave(document)
  }, [runSave])

  // An explicit, awaitable save. Clears a stale save error first, so it doubles
  // as a retry, and reports its own outcome to the caller.
  const saveImmediately = useCallback((document: BoardDocument): Promise<ImmediateSaveResult> => {
    setSaveError(null)
    return runSave(document)
  }, [runSave])

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

  const confirmReset = useCallback(async (hostBoard: BoardDocument): Promise<{ ok: true; hostBoard: BoardDocument } | { ok: false; message: string }> => {
    try {
      await storage.clear()
      baselineEpochRef.current += 1
      revisionRef.current = hostBoard.documentRevision
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

  const applyImmediateReset = useCallback(async (hostBoard: BoardDocument): Promise<{ ok: true; hostBoard: BoardDocument } | { ok: false; message: string }> => {
    try {
      await storage.clear()
      baselineEpochRef.current += 1
      revisionRef.current = hostBoard.documentRevision
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
    acknowledgeBoardPatch,
    save,
    saveImmediately,
    clearSaveError,
    clearResetError,
    requestReset,
    cancelReset,
    confirmReset,
    applyImmediateReset,
  }
}
