import type { BoardDocument } from './board-document.schema'
import { restoreBoard, STORAGE_KEY } from './board-local-storage'

export function loadBoardFromHostStorage(
  hostBoard: BoardDocument,
  storage: Pick<Storage, 'getItem' | 'removeItem'> = localStorage,
): { document: BoardDocument; lastSaved: BoardDocument } {
  try {
    const restored = restoreBoard(hostBoard, storage)
    if (restored.boardId === hostBoard.boardId) {
      return { document: restored, lastSaved: restored }
    }
    return { document: hostBoard, lastSaved: hostBoard }
  } catch {
    try {
      storage.removeItem(STORAGE_KEY)
    } catch {
      // A blocked cleanup must not prevent the validated host board from loading.
    }
    return { document: hostBoard, lastSaved: hostBoard }
  }
}