import type { BoardDocument } from './board-document.schema'
import { restoreBoard } from './board-local-storage'
import { ensureZonesForAllUnits } from './ensure-zones-for-unit'

export function loadBoardFromHostStorage(
  hostBoard: BoardDocument,
  storage: Pick<Storage, 'getItem'> = localStorage,
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
    // A stored payload that fails to parse is left in place, not deleted: the
    // host board still loads, and the payload stays recoverable by hand. The
    // next successful save overwrites it.
    const document = ensureZonesForAllUnits(hostBoard)
    return { document, lastSaved: document }
  }
}
