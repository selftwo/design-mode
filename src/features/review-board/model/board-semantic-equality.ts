import type { BoardDocument } from './board-document.schema'
import { serializeBoard } from './board-local-storage'

export function boardsSemanticallyEqual(left: BoardDocument, right: BoardDocument): boolean {
  return serializeBoard(left) === serializeBoard(right)
}