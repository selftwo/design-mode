import type { AgentRun } from './host-api.schema'

// A learn/ask waiting for its teach answer. The answer normally arrives on a
// board-patched event matched by requestId; runId ties the wait to the
// journaled agent run so a failed run or a dropped event stream can release
// the request instead of leaving it pending forever.
export interface PendingLearnRequest {
  requestId: string
  runId: string
  askedAtMs: number
}

// Backstop for answers lost to a dropped stream with no reconnect: past this
// age the run has either finished (its events were missed) or hung, so the
// wait is released and the reviewer sees the learn error instead of a count
// that never resolves.
export const LEARN_ANSWER_TIMEOUT_MS = 5 * 60_000

export function addPendingLearn(
  pending: readonly PendingLearnRequest[],
  request: PendingLearnRequest,
): PendingLearnRequest[] {
  return [...pending.filter((item) => item.requestId !== request.requestId), request]
}

export function removePendingLearn(
  pending: readonly PendingLearnRequest[],
  requestIds: readonly string[],
): PendingLearnRequest[] {
  if (requestIds.length === 0) return [...pending]
  const drop = new Set(requestIds)
  return pending.filter((item) => !drop.has(item.requestId))
}

export function hasPendingLearn(pending: readonly PendingLearnRequest[], requestId: string): boolean {
  return pending.some((item) => item.requestId === requestId)
}

// A failed run can never append its teach answer, so its requests are released
// the moment the run-updated event reports the failure.
export function failedLearnRequestIds(pending: readonly PendingLearnRequest[], run: AgentRun): string[] {
  if (run.status !== 'failed') return []
  return pending.filter((item) => item.runId === run.id).map((item) => item.requestId)
}

// After a stream reconnect, events emitted while disconnected are gone. A
// request whose run is missing from the resynced list or already terminal will
// never get its board-patched answer now, so it is released. A run still
// queued or running keeps its request: the answer can still arrive.
export function unanswerableLearnRequestIds(
  pending: readonly PendingLearnRequest[],
  runs: readonly AgentRun[],
): string[] {
  const byId = new Map(runs.map((run) => [run.id, run]))
  return pending
    .filter((item) => {
      const run = byId.get(item.runId)
      return !run || run.status === 'done' || run.status === 'failed'
    })
    .map((item) => item.requestId)
}

export function expiredLearnRequestIds(
  pending: readonly PendingLearnRequest[],
  nowMs: number,
): string[] {
  return pending
    .filter((item) => nowMs - item.askedAtMs >= LEARN_ANSWER_TIMEOUT_MS)
    .map((item) => item.requestId)
}
