import type { BoardDocument } from './model/board-document.schema'
import type { HostCaptureRefreshResult } from './host/host-live-message.schema'

export const CAPTURE_REFRESH_TIMEOUT_MS = 30_000
export const CAPTURE_REFRESH_TIMEOUT_ERROR = 'Capture refresh timed out'

export interface CaptureRefreshPendingIdentity {
  requestId: string
  boardId: string
  frameId: string
  captureHash: string
  revision: number
}

export interface CaptureRefreshPendingRequest {
  requestId: string
  frameId: string
}

export function buildCaptureRefreshPendingIdentity(
  document: BoardDocument,
  frameId: string,
  requestId: string,
): CaptureRefreshPendingIdentity | { error: string } {
  const frame = document.frames.find((item) => item.id === frameId)
  if (!frame) return { error: `Unknown frame ${frameId}` }
  return {
    requestId,
    boardId: document.boardId,
    frameId,
    captureHash: frame.captureHash,
    revision: frame.revision,
  }
}

export function captureRefreshIdentityStillMatches(
  document: BoardDocument,
  pending: CaptureRefreshPendingIdentity,
): boolean {
  if (document.boardId !== pending.boardId) return false
  const frame = document.frames.find((item) => item.id === pending.frameId)
  if (!frame) return false
  return frame.captureHash === pending.captureHash && frame.revision === pending.revision
}

export function acceptCaptureRefreshResult(
  pending: CaptureRefreshPendingRequest | null,
  result: HostCaptureRefreshResult,
): result is Extract<HostCaptureRefreshResult, { status: 'refreshed' | 'failed' }> {
  if (result.status === 'ignored') return false
  if (pending === null) return false
  return pending.requestId === result.requestId && pending.frameId === result.frameId
}

export function clearHostRequestTimeoutIfPending<T extends { requestId: string }>(
  pending: T | null,
  requestId: string,
): { pending: T | null; timedOut: boolean } {
  if (pending?.requestId !== requestId) {
    return { pending, timedOut: false }
  }
  return { pending: null, timedOut: true }
}

export function shouldApplyCaptureRefreshSuccess(
  document: BoardDocument,
  pending: CaptureRefreshPendingIdentity | null,
  result: HostCaptureRefreshResult,
): boolean {
  if (result.status !== 'refreshed') return false
  if (pending === null) return false
  if (pending.requestId !== result.requestId || pending.frameId !== result.frameId) return false
  return captureRefreshIdentityStillMatches(document, pending)
}

export function shouldApplyCaptureRefreshFailure(
  pending: CaptureRefreshPendingIdentity | null,
  result: HostCaptureRefreshResult,
): result is Extract<HostCaptureRefreshResult, { status: 'failed' }> {
  if (result.status !== 'failed') return false
  if (pending === null) return false
  return pending.requestId === result.requestId && pending.frameId === result.frameId
}