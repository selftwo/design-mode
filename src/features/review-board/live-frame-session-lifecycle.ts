import type { HostLiveSessionResult } from './host/host-live-message.schema'

export const HOST_LIVE_SESSION_TIMEOUT_MS = 15_000
export const HOST_LIVE_SESSION_TIMEOUT_ERROR = 'Live session request timed out'
export const LIVE_FOCUS_TOKEN_REUSE_ERROR = 'Live session is unavailable (focus token already used)'

export interface PendingHostRequest {
  requestId: string
  frameId: string
}

export function acceptLiveSessionResult(
  pending: PendingHostRequest | null,
  result: HostLiveSessionResult,
): result is Extract<HostLiveSessionResult, { status: 'ready' | 'rejected' }> {
  if (result.status === 'ignored') return false
  if (pending === null) return false
  return pending.requestId === result.requestId && pending.frameId === result.frameId
}

export function createLiveFocusTokenHistory() {
  const accepted = new Set<string>()

  return {
    hasAccepted(token: string): boolean {
      return accepted.has(token)
    },
    recordAccepted(token: string): void {
      accepted.add(token)
    },
  }
}

export type LiveFocusTokenHistory = ReturnType<typeof createLiveFocusTokenHistory>

export function claimLiveFocusToken(
  history: LiveFocusTokenHistory,
  focusToken: string,
): string | null {
  if (history.hasAccepted(focusToken)) return LIVE_FOCUS_TOKEN_REUSE_ERROR
  history.recordAccepted(focusToken)
  return null
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