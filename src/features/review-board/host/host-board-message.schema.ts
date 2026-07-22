import { z } from 'zod'
import {
  BOARD_SCHEMA_VERSION,
  type BoardDocument,
} from '../model/board-document.schema'
import { safeParseBoardDocument } from '../model/board-document-migration'

export const HOST_BOARD_MESSAGE_VERSION = 1 as const
export const HOST_BOARD_LOAD_TYPE = 'design-review/load-board' as const
export const HOST_BOARD_REQUEST_TYPE = 'design-review/request-board' as const

export const HostBoardLoadEnvelopeSchema = z.object({
  type: z.literal(HOST_BOARD_LOAD_TYPE),
  schemaVersion: z.unknown(),
  board: z.unknown(),
})

export const HostBoardRequestSchema = z.object({
  type: z.literal(HOST_BOARD_REQUEST_TYPE),
  schemaVersion: z.literal(HOST_BOARD_MESSAGE_VERSION),
})

export type HostBoardLoadResult =
  | { status: 'loaded'; board: BoardDocument }
  | { status: 'rejected'; error: string }
  | { status: 'ignored' }

function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'board'}: ${issue.message}`)
    .join('; ')
}

export function readHostBoardLoadMessage(value: unknown): HostBoardLoadResult {
  if (!value || typeof value !== 'object' || !('type' in value) || value.type !== HOST_BOARD_LOAD_TYPE) {
    return { status: 'ignored' }
  }

  const envelope = HostBoardLoadEnvelopeSchema.safeParse(value)
  if (!envelope.success) {
    return { status: 'rejected', error: `Invalid host board message: ${formatIssues(envelope.error)}` }
  }
  if (envelope.data.schemaVersion !== HOST_BOARD_MESSAGE_VERSION) {
    return {
      status: 'rejected',
      error: `Unsupported host message version ${String(envelope.data.schemaVersion)}. This app supports version ${HOST_BOARD_MESSAGE_VERSION}.`,
    }
  }

  const boardVersion = envelope.data.board && typeof envelope.data.board === 'object' && 'schemaVersion' in envelope.data.board
    ? envelope.data.board.schemaVersion
    : undefined
  // A v1 board is migrated on the way in; only versions this app does not know
  // are rejected outright.
  if (boardVersion !== 1 && boardVersion !== BOARD_SCHEMA_VERSION) {
    return {
      status: 'rejected',
      error: `Unsupported board schema version ${String(boardVersion)}. This app supports version ${BOARD_SCHEMA_VERSION}.`,
    }
  }

  const board = safeParseBoardDocument(envelope.data.board)
  if (!board.success) {
    return { status: 'rejected', error: `Invalid board data: ${formatIssues(board.error)}` }
  }
  return { status: 'loaded', board: board.data }
}
