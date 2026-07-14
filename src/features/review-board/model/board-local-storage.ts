import { BoardDocumentSchema, type BoardDocument } from './board-document.schema'

export const STORAGE_KEY = 'design-review-canvas-v1'

export function serializeBoard(document: BoardDocument): string {
  return JSON.stringify(BoardDocumentSchema.parse(document))
}

export function deserializeBoard(serialized: string): BoardDocument {
  const value: unknown = JSON.parse(serialized)
  return BoardDocumentSchema.parse(value)
}

export function saveBoard(document: BoardDocument, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(STORAGE_KEY, serializeBoard(document))
}

export function restoreBoard(
  fallback: BoardDocument,
  storage: Pick<Storage, 'getItem'> = localStorage,
): BoardDocument {
  const serialized = storage.getItem(STORAGE_KEY)
  return serialized ? deserializeBoard(serialized) : fallback
}
