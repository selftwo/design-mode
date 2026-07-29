import type { ReviewSummary, ScreenFrame } from './board-document.schema'
import { isOptionFrame } from './board-relations'

// Exploration should leave traces without becoming an event log. This is a
// bounded per-frame accumulator: it integrates how long each frame was looked at
// (only while active, at least half in the viewport, and the page visible),
// counts the distinct kit states tried (capped), and remembers whether the frame
// was played live. It stores totals, never a timeline. All functions are pure:
// they take a state and return a new one.

// At most this many distinct kit states are counted per frame, so a reviewer who
// flips controls endlessly cannot grow the trace without bound.
export const KIT_STATES_PER_FRAME_CAP = 50
// A frame is "reviewed" once it was looked at this long, or played live.
export const REVIEWED_VISIBLE_SECONDS = 2
// A frame must be at least this fraction inside the viewport to accrue dwell.
export const MIN_VISIBLE_FRACTION = 0.5

interface FrameTrace {
  // Total visible time, seeded from a loaded board so totals never go backward.
  visibleMs: number
  // Distinct kit states counted before this session (from the loaded board).
  seededKitStates: number
  // Distinct kit-state signatures seen this session, for in-session dedup.
  sessionKitSignatures: string[]
  playedLive: boolean
}

export interface ReviewTelemetry {
  traces: Record<string, FrameTrace>
  // Wall-clock start of the currently open span, or null before the first sample.
  openSinceMs: number | null
  // Frame ids that accrue dwell during the currently open span.
  accruing: string[]
}

function emptyTrace(): FrameTrace {
  return { visibleMs: 0, seededKitStates: 0, sessionKitSignatures: [], playedLive: false }
}

export function createReviewTelemetry(): ReviewTelemetry {
  return { traces: {}, openSinceMs: null, accruing: [] }
}

// Seeds the accumulator from a loaded board's saved totals so a reload keeps the
// prior traces and a later flush never erases them.
export function seedReviewTelemetry(summaries: readonly ReviewSummary[]): ReviewTelemetry {
  const traces: Record<string, FrameTrace> = {}
  for (const summary of summaries) {
    traces[summary.frameId] = {
      visibleMs: Math.max(0, summary.visibleSeconds) * 1000,
      seededKitStates: Math.min(KIT_STATES_PER_FRAME_CAP, Math.max(0, summary.kitStatesTried)),
      sessionKitSignatures: [],
      playedLive: summary.playedLive,
    }
  }
  return { traces, openSinceMs: null, accruing: [] }
}

function withTrace(state: ReviewTelemetry, frameId: string, change: (trace: FrameTrace) => FrameTrace): ReviewTelemetry {
  const current = state.traces[frameId] ?? emptyTrace()
  return { ...state, traces: { ...state.traces, [frameId]: change(current) } }
}

// Closes the open span, crediting the elapsed time to every frame that was
// accruing, then opens a fresh span over the frames visible right now. A hidden
// page accrues nothing. Time never runs backward: a non-monotonic clock credits
// zero rather than a negative span.
export function sampleVisibility(
  state: ReviewTelemetry,
  input: { nowMs: number; visibleFrameIds: readonly string[]; pageVisible: boolean },
): ReviewTelemetry {
  const traces = { ...state.traces }
  if (state.openSinceMs !== null) {
    const delta = Math.max(0, input.nowMs - state.openSinceMs)
    if (delta > 0) {
      for (const id of state.accruing) {
        const trace = traces[id] ?? emptyTrace()
        traces[id] = { ...trace, visibleMs: trace.visibleMs + delta }
      }
    }
  }
  const accruing = input.pageVisible ? [...new Set(input.visibleFrameIds)] : []
  return { traces, openSinceMs: input.nowMs, accruing }
}

// Records one kit state the reviewer landed on. Repeats are ignored; the count is
// capped per frame.
export function recordKitState(state: ReviewTelemetry, frameId: string, signature: string): ReviewTelemetry {
  return withTrace(state, frameId, (trace) => {
    if (trace.sessionKitSignatures.includes(signature)) return trace
    if (trace.seededKitStates + trace.sessionKitSignatures.length >= KIT_STATES_PER_FRAME_CAP) return trace
    return { ...trace, sessionKitSignatures: [...trace.sessionKitSignatures, signature] }
  })
}

export function recordPlayedLive(state: ReviewTelemetry, frameId: string): ReviewTelemetry {
  return withTrace(state, frameId, (trace) => (trace.playedLive ? trace : { ...trace, playedLive: true }))
}

function traceToSummary(frameId: string, trace: FrameTrace): ReviewSummary {
  return {
    frameId,
    visibleSeconds: Math.round(trace.visibleMs / 1000),
    kitStatesTried: Math.min(KIT_STATES_PER_FRAME_CAP, trace.seededKitStates + trace.sessionKitSignatures.length),
    playedLive: trace.playedLive,
  }
}

// The saved shape of the traces. `keepFrameIds`, when given, drops traces for
// frames no longer on the board so a delete does not leave orphans behind.
export function toReviewSummaries(state: ReviewTelemetry, keepFrameIds?: Iterable<string>): ReviewSummary[] {
  const keep = keepFrameIds ? new Set(keepFrameIds) : null
  return Object.entries(state.traces)
    .filter(([frameId]) => (keep ? keep.has(frameId) : true))
    .map(([frameId, trace]) => traceToSummary(frameId, trace))
    .sort((a, b) => (a.frameId < b.frameId ? -1 : a.frameId > b.frameId ? 1 : 0))
}

export function isReviewed(summary: ReviewSummary): boolean {
  return summary.playedLive || summary.visibleSeconds >= REVIEWED_VISIBLE_SECONDS
}

// A non-blocking heads-up for a promote: the winner was never played live, or
// sibling options went unreviewed. Returns null when the decision looks well
// explored. Advisory only, so a reviewer who knows their mind can still confirm.
export function verdictReviewWarning(
  frames: readonly ScreenFrame[],
  summaries: readonly ReviewSummary[],
  unitId: string,
  winnerFrameId: string,
): string | null {
  const byId = new Map(summaries.map((summary) => [summary.frameId, summary]))
  const reviewed = (id: string): boolean => {
    const summary = byId.get(id)
    return summary ? isReviewed(summary) : false
  }
  const parts: string[] = []
  const winner = frames.find((frame) => frame.id === winnerFrameId)
  if (winner?.kind === 'playable-option' && !byId.get(winnerFrameId)?.playedLive) {
    parts.push('this option was never played live')
  }
  const unreviewedSiblings = frames.filter((frame) => frame.unitId === unitId
    && frame.id !== winnerFrameId
    && isOptionFrame(frame)
    && frame.lifeState === 'active'
    && !reviewed(frame.id)).length
  if (unreviewedSiblings > 0) {
    parts.push(`${unreviewedSiblings} other option${unreviewedSiblings === 1 ? ' was' : 's were'} not reviewed`)
  }
  if (parts.length === 0) return null
  return `Heads up: ${parts.join(', and ')}.`
}

// A stable signature for a frame's current kit state: sorted `id=value` pairs.
// Two visits to the same control values produce the same string, so re-landing
// on a state is not counted twice.
export function kitStateSignature(state: Record<string, boolean | string>): string {
  return Object.keys(state)
    .sort()
    .map((key) => `${key}=${String(state[key])}`)
    .join('&')
}

const MIN_VIEW_ZOOM = 0.0001

// The frame ids that accrue dwell right now: active frames at least half inside
// the current viewport. Pure geometry over the React Flow transform, kept out of
// the engine so the adapter only reports raw viewport numbers.
export function visibleFrameIds(
  frames: readonly ScreenFrame[],
  view: { x: number; y: number; zoom: number },
  canvasSize: { width: number; height: number },
  minFraction: number = MIN_VISIBLE_FRACTION,
): string[] {
  const zoom = view.zoom || MIN_VIEW_ZOOM
  const left = -view.x / zoom
  const top = -view.y / zoom
  const right = left + canvasSize.width / zoom
  const bottom = top + canvasSize.height / zoom
  const ids: string[] = []
  for (const frame of frames) {
    if (frame.lifeState !== 'active') continue
    const area = frame.width * frame.height
    if (area <= 0) continue
    const overlapWidth = Math.max(0, Math.min(frame.x + frame.width, right) - Math.max(frame.x, left))
    const overlapHeight = Math.max(0, Math.min(frame.y + frame.height, bottom) - Math.max(frame.y, top))
    if ((overlapWidth * overlapHeight) / area >= minFraction) ids.push(frame.id)
  }
  return ids
}
