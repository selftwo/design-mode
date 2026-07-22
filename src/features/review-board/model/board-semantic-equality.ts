import type { BoardDocument } from './board-document.schema'
import { BoardDocumentSchema } from './board-document.schema'

function serializeBoardSemantic(document: BoardDocument): string {
  const { documentRevision: _revision, ...semantic } = BoardDocumentSchema.parse(document)
  return JSON.stringify(semantic)
}

export function boardsSemanticallyEqual(left: BoardDocument, right: BoardDocument): boolean {
  return serializeBoardSemantic(left) === serializeBoardSemantic(right)
}
