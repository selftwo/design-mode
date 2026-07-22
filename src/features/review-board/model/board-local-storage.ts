import { BoardDocumentSchema, type BoardDocument } from './board-document.schema'
import { parseBoardDocument } from './board-document-migration'

export const STORAGE_KEY = 'design-review-canvas-v2'
export const LEGACY_STORAGE_KEY = 'design-review-canvas-v1'

export function serializeBoard(document: BoardDocument): string {
  return JSON.stringify(BoardDocumentSchema.parse(document))
}

export function deserializeBoard(serialized: string): BoardDocument {
  const value: unknown = JSON.parse(serialized)
  return parseBoardDocument(value)
}

export function saveBoard(document: BoardDocument, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(STORAGE_KEY, serializeBoard(document))
}

export function clearStoredBoard(storage: Pick<Storage, 'removeItem'> = localStorage): void {
  storage.removeItem(STORAGE_KEY)
  storage.removeItem(LEGACY_STORAGE_KEY)
}

export function restoreBoard(
  fallback: BoardDocument,
  storage: Pick<Storage, 'getItem'> = localStorage,
): BoardDocument {
  // A v2 override wins; a leftover v1 override is migrated on read and rewritten
  // as v2 on the next save.
  const current = storage.getItem(STORAGE_KEY)
  if (current) return deserializeBoard(current)
  const legacy = storage.getItem(LEGACY_STORAGE_KEY)
  if (legacy) return deserializeBoard(legacy)
  return fallback
}
