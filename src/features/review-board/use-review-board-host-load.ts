import { useEffect, useRef, useState } from 'react'
import type { BoardDocument } from './model/board-document.schema'
import { loadBoardFromHostStorage } from './model/load-board-from-host-storage'
import type { BoardHost } from './host/window-board-host'

export function useReviewBoardHostLoad(
  host: BoardHost,
  setBaseline: (document: BoardDocument) => void,
  onBoardLoaded?: () => void,
) {
  const onBoardLoadedRef = useRef(onBoardLoaded)
  onBoardLoadedRef.current = onBoardLoaded
  const [document, setDocument] = useState<BoardDocument | null>(null)
  const [hostBoard, setHostBoard] = useState<BoardDocument | null>(null)
  const [boardLoadError, setBoardLoadError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = host.subscribe((result) => {
      if (result.status === 'rejected') {
        setBoardLoadError(result.error)
        return
      }
      if (result.status !== 'loaded') return
      const loaded = loadBoardFromHostStorage(result.board)
      setHostBoard(result.board)
      setDocument(loaded.document)
      setBaseline(loaded.lastSaved)
      setBoardLoadError(null)
      onBoardLoadedRef.current?.()
    })
    host.requestBoard()
    return unsubscribe
  }, [host, setBaseline])

  return {
    document,
    setDocument,
    hostBoard,
    boardLoadError,
    setBoardLoadError,
    resetLoadedBoard: (board: BoardDocument) => {
      setDocument(board)
      setBoardLoadError(null)
    },
  }
}