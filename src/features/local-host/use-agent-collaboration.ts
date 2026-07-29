import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { BoardDocument, ReviewAnnotation } from '../review-board/model/board-document.schema'
import { mergeBoardPatch } from '../review-board/model/merge-board-patch'
import type { AgentAvailability, AgentRun } from './host-api.schema'
import type { HostConnectionState, LocalHostClient } from './local-host-client'
import {
  addPendingLearn,
  expiredLearnRequestIds,
  failedLearnRequestIds,
  removePendingLearn,
  unanswerableLearnRequestIds,
  type PendingLearnRequest,
} from './pending-learn-requests'

// Bounded: the islands show a handful of runs; a long session must not
// accumulate every run event in memory.
const AGENT_RUN_LIMIT = 30
const LEARN_EXPIRY_SWEEP_MS = 30_000
const LEARN_FAILED_MESSAGE = 'The agent could not answer this question.'

// Local app mode: agents appear as collaborators. The host streams run and
// capture events; a finished run refreshes captures and reloads the board once
// local edits are safe. The learn/ask round trip also lives here: a question
// is pinned back as a teach note matched by request id, and a request whose
// answer can no longer arrive (failed run, missed events, timeout) is released
// into the learn error state instead of waiting forever.
export function useAgentCollaboration({
  localHost,
  setDocument,
  acknowledgeBoardPatch,
  onLearnAnswer,
}: {
  localHost: LocalHostClient | null
  setDocument: Dispatch<SetStateAction<BoardDocument | null>>
  acknowledgeBoardPatch: (patchRevision: number, mergeInto: (board: BoardDocument) => BoardDocument) => void
  // Called when a teach answer to one of this session's asks lands, so the
  // caller can open it at its anchor.
  onLearnAnswer: (annotation: ReviewAnnotation) => void
}) {
  const [dispatchAgents, setDispatchAgents] = useState<AgentAvailability[] | null>(null)
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([])
  const [captureActive, setCaptureActive] = useState(false)
  const [boardUpdateWaiting, setBoardUpdateWaiting] = useState(false)
  const [hostConnection, setHostConnection] = useState<HostConnectionState>('connected')
  // Learn/ask round trip: requests waiting for a teach answer. The ref is read
  // in the SSE handler (which is not re-subscribed per ask); the count drives UI.
  const learnPendingRef = useRef<readonly PendingLearnRequest[]>([])
  const [learnPendingCount, setLearnPendingCount] = useState(0)
  const [learnAsking, setLearnAsking] = useState(false)
  const [learnError, setLearnError] = useState<string | null>(null)
  const onLearnAnswerRef = useRef(onLearnAnswer)
  onLearnAnswerRef.current = onLearnAnswer

  const releaseLearnRequests = useCallback((requestIds: string[], message: string) => {
    if (requestIds.length === 0) return
    learnPendingRef.current = removePendingLearn(learnPendingRef.current, requestIds)
    setLearnPendingCount(learnPendingRef.current.length)
    setLearnError(message)
  }, [])

  useEffect(() => {
    if (!localHost?.activeProjectId) return
    void localHost.listAgents().then(setDispatchAgents).catch(() => setDispatchAgents([]))
    const syncRuns = () => localHost.listRuns().then((runs) => {
      setAgentRuns(runs
        .filter((run) => run.projectId === localHost.activeProjectId)
        .slice(0, AGENT_RUN_LIMIT))
      return runs
    })
    void syncRuns().catch(() => {})
    // EventSource reconnects on its own but events sent while it was down are
    // gone: on reconnect the run list is resynced as fresh state, and asks
    // whose answer can no longer arrive over the stream are released.
    let streamDropped = false
    const onConnectionChange = (state: HostConnectionState) => {
      setHostConnection(state)
      if (state === 'reconnecting') {
        streamDropped = true
        return
      }
      if (!streamDropped) return
      streamDropped = false
      void syncRuns()
        .then((runs) => {
          releaseLearnRequests(unanswerableLearnRequestIds(learnPendingRef.current, runs), LEARN_FAILED_MESSAGE)
        })
        .catch(() => {})
    }
    return localHost.subscribeHostEvents((event) => {
      if (event.type === 'run-updated') {
        if (event.run.projectId === localHost.activeProjectId) {
          setAgentRuns((current) => [event.run, ...current.filter((run) => run.id !== event.run.id)].slice(0, AGENT_RUN_LIMIT))
        }
        releaseLearnRequests(
          failedLearnRequestIds(learnPendingRef.current, event.run),
          event.run.error ? `${LEARN_FAILED_MESSAGE} ${event.run.error}` : LEARN_FAILED_MESSAGE,
        )
      }
      if (event.type === 'capture-started' && event.projectId === localHost.activeProjectId) {
        setCaptureActive(true)
      }
      if (event.type === 'capture-failed' && event.projectId === localHost.activeProjectId) {
        setCaptureActive(false)
      }
      if (event.type === 'board-updated' && event.projectId === localHost.activeProjectId) {
        setCaptureActive(false)
        setBoardUpdateWaiting(true)
      }
      // Agent-authored records: merge by id into the live document without a
      // full reload, including when the reviewer has unsaved local edits.
      if (event.type === 'board-patched' && event.projectId === localHost.activeProjectId) {
        const patch = {
          documentRevision: event.documentRevision,
          records: event.records,
        }
        setDocument((current) => (current ? mergeBoardPatch(current, patch) : current))
        acknowledgeBoardPatch(event.documentRevision, (saved) => mergeBoardPatch(saved, patch))
        // A teach answer to one of our asks: open it at its anchor so the
        // reviewer sees the pinned note the moment it lands.
        const answer = event.records.find((record) =>
          record.annotation.role === 'teach'
          && record.annotation.requestId !== undefined
          && learnPendingRef.current.some((item) => item.requestId === record.annotation.requestId))
        if (answer) {
          learnPendingRef.current = removePendingLearn(learnPendingRef.current, [answer.annotation.requestId!])
          setLearnPendingCount(learnPendingRef.current.length)
          onLearnAnswerRef.current(answer.annotation)
        }
      }
    }, onConnectionChange)
  }, [localHost, acknowledgeBoardPatch, setDocument, releaseLearnRequests])

  // Backstop for a stream that never reconnects: expire asks past the timeout.
  useEffect(() => {
    if (!localHost) return
    const timer = window.setInterval(() => {
      releaseLearnRequests(expiredLearnRequestIds(learnPendingRef.current, Date.now()), LEARN_FAILED_MESSAGE)
    }, LEARN_EXPIRY_SWEEP_MS)
    return () => window.clearInterval(timer)
  }, [localHost, releaseLearnRequests])

  // Send a learn/ask to the current agent about a screen. The answer is pinned
  // back as a teach note by request id; the SSE handler above opens it on arrival.
  // Anchored at the frame center: the ask is about the screen, not a picked point.
  const askLearn = useCallback((frameId: string, question: string) => {
    if (!localHost || learnAsking) return
    const requestId = crypto.randomUUID()
    setLearnAsking(true)
    setLearnError(null)
    localHost.requestLearnAnswer({ frameId, anchor: [0.5, 0.5], question, requestId })
      .then((run) => {
        learnPendingRef.current = addPendingLearn(learnPendingRef.current, {
          requestId,
          runId: run.id,
          askedAtMs: Date.now(),
        })
        setLearnPendingCount(learnPendingRef.current.length)
      })
      .catch((error: unknown) => {
        setLearnError(error instanceof Error ? error.message : 'The question could not be sent.')
      })
      .finally(() => setLearnAsking(false))
  }, [localHost, learnAsking])

  const acknowledgeBoardUpdate = useCallback(() => setBoardUpdateWaiting(false), [])
  const dismissLearnError = useCallback(() => setLearnError(null), [])

  return {
    dispatchAgents,
    agentRuns,
    captureActive,
    boardUpdateWaiting,
    acknowledgeBoardUpdate,
    hostConnection,
    learnPendingCount,
    learnAsking,
    learnError,
    askLearn,
    dismissLearnError,
  }
}
