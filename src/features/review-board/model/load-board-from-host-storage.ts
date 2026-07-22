import type { BoardDocument } from './board-document.schema'
import { LEGACY_STORAGE_KEY, restoreBoard, STORAGE_KEY } from './board-local-storage'
import { ensureZonesForAllUnits } from './ensure-zones-for-unit'

export function loadBoardFromHostStorage(
  hostBoard: BoardDocument,
  storage: Pick<Storage, 'getItem' | 'removeItem'> = localStorage,
): { document: BoardDocument; lastSaved: BoardDocument } {
  try {
    const restored = restoreBoard(hostBoard, storage)
    if (restored.boardId === hostBoard.boardId) {
      const document = ensureZonesForAllUnits(restored)
      return { document, lastSaved: document }
    }
    const document = ensureZonesForAllUnits(hostBoard)
    return { document, lastSaved: document }
  } catch {
    try {
      storage.removeItem(STORAGE_KEY)
      storage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      // A blocked cleanup must not prevent the validated host board from loading.
    }
    const document = ensureZonesForAllUnits(hostBoard)
    return { document, lastSaved: document }
  }
}
