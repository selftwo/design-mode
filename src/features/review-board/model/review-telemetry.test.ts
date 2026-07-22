import { describe, expect, it } from 'vitest'
import type { ScreenFrame } from './board-document.schema'
import {
  KIT_STATES_PER_FRAME_CAP,
  createReviewTelemetry,
  isReviewed,
  kitStateSignature,
  recordKitState,
  recordPlayedLive,
  sampleVisibility,
  seedReviewTelemetry,
  toReviewSummaries,
  verdictReviewWarning,
  visibleFrameIds,
} from './review-telemetry'
import type { ReviewSummary } from './board-document.schema'

function frame(id: string, over: Partial<ScreenFrame> = {}): ScreenFrame {
  return {
    id,
    label: id,
    route: '/x',
    viewport: { width: 1440, height: 900 },
    x: 0,
    y: 0,
    width: 400,
    height: 250,
    aspectRatio: 1.6,
    screenshotPath: `screens/${id}.png`,
    screenshotDataUrl: 'data:image/png;base64,AAAA',
    refreshedScreenshotDataUrl: 'data:image/png;base64,AAAA',
    captureHash: `${id}-hash`,
    revision: 1,
    elements: [],
    kind: 'captured-route',
    lifeState: 'active',
    ...over,
  }
}

describe('sampleVisibility dwell', () => {
  it('credits elapsed time only to the frames that were accruing', () => {
    let state = createReviewTelemetry()
    state = sampleVisibility(state, { nowMs: 0, visibleFrameIds: ['a'], pageVisible: true })
    state = sampleVisibility(state, { nowMs: 3000, visibleFrameIds: ['b'], pageVisible: true })
    // 'a' was accruing across the 0..3000 span; 'b' only opens its span at 3000.
    state = sampleVisibility(state, { nowMs: 4000, visibleFrameIds: [], pageVisible: true })
    const summaries = Object.fromEntries(toReviewSummaries(state).map((s) => [s.frameId, s.visibleSeconds]))
    expect(summaries.a).toBe(3)
    expect(summaries.b).toBe(1)
  })

  it('accrues nothing while the page is hidden', () => {
    let state = createReviewTelemetry()
    state = sampleVisibility(state, { nowMs: 0, visibleFrameIds: ['a'], pageVisible: false })
    state = sampleVisibility(state, { nowMs: 5000, visibleFrameIds: ['a'], pageVisible: true })
    state = sampleVisibility(state, { nowMs: 6000, visibleFrameIds: ['a'], pageVisible: true })
    expect(toReviewSummaries(state).find((s) => s.frameId === 'a')?.visibleSeconds).toBe(1)
  })

  it('never subtracts time when the clock goes backward', () => {
    let state = createReviewTelemetry()
    state = sampleVisibility(state, { nowMs: 0, visibleFrameIds: ['a'], pageVisible: true })
    state = sampleVisibility(state, { nowMs: 3000, visibleFrameIds: ['a'], pageVisible: true })
    // A backward jump closes the span with a clamped-zero delta, so the 3s stays.
    state = sampleVisibility(state, { nowMs: 1000, visibleFrameIds: [], pageVisible: true })
    expect(toReviewSummaries(state).find((s) => s.frameId === 'a')?.visibleSeconds).toBe(3)
  })
})

describe('kit states', () => {
  it('counts distinct kit states and ignores repeats', () => {
    let state = createReviewTelemetry()
    state = recordKitState(state, 'a', kitStateSignature({ dense: false, theme: 'light' }))
    state = recordKitState(state, 'a', kitStateSignature({ theme: 'light', dense: false }))
    state = recordKitState(state, 'a', kitStateSignature({ dense: true, theme: 'light' }))
    expect(toReviewSummaries(state).find((s) => s.frameId === 'a')?.kitStatesTried).toBe(2)
  })

  it('caps the count per frame', () => {
    let state = createReviewTelemetry()
    for (let index = 0; index < KIT_STATES_PER_FRAME_CAP + 20; index += 1) {
      state = recordKitState(state, 'a', `sig-${index}`)
    }
    expect(toReviewSummaries(state).find((s) => s.frameId === 'a')?.kitStatesTried).toBe(KIT_STATES_PER_FRAME_CAP)
  })
})

describe('played live and reviewed', () => {
  it('flags a frame that was played live and counts it reviewed', () => {
    let state = createReviewTelemetry()
    state = recordPlayedLive(state, 'a')
    const summary = toReviewSummaries(state).find((s) => s.frameId === 'a')!
    expect(summary.playedLive).toBe(true)
    expect(isReviewed(summary)).toBe(true)
  })

  it('counts a briefly seen frame as not reviewed', () => {
    let state = createReviewTelemetry()
    state = sampleVisibility(state, { nowMs: 0, visibleFrameIds: ['a'], pageVisible: true })
    state = sampleVisibility(state, { nowMs: 500, visibleFrameIds: [], pageVisible: true })
    const summary = toReviewSummaries(state).find((s) => s.frameId === 'a')!
    expect(isReviewed(summary)).toBe(false)
  })
})

describe('seeding and pruning', () => {
  it('keeps prior totals so a reload does not erase them', () => {
    let state = seedReviewTelemetry([{ frameId: 'a', visibleSeconds: 4, kitStatesTried: 2, playedLive: false }])
    state = sampleVisibility(state, { nowMs: 0, visibleFrameIds: ['a'], pageVisible: true })
    state = sampleVisibility(state, { nowMs: 2000, visibleFrameIds: [], pageVisible: true })
    state = recordKitState(state, 'a', 'new-sig')
    const summary = toReviewSummaries(state).find((s) => s.frameId === 'a')!
    expect(summary.visibleSeconds).toBe(6)
    expect(summary.kitStatesTried).toBe(3)
  })

  it('drops traces for frames no longer on the board', () => {
    let state = createReviewTelemetry()
    state = recordPlayedLive(state, 'gone')
    state = recordPlayedLive(state, 'kept')
    const summaries = toReviewSummaries(state, ['kept'])
    expect(summaries.map((s) => s.frameId)).toEqual(['kept'])
  })
})

describe('visibleFrameIds', () => {
  const view = { x: 0, y: 0, zoom: 1 }
  const canvas = { width: 1000, height: 1000 }

  it('includes an active frame at least half in view and excludes an offscreen one', () => {
    const frames = [frame('in', { x: 0, y: 0 }), frame('out', { x: 5000, y: 0 })]
    expect(visibleFrameIds(frames, view, canvas)).toEqual(['in'])
  })

  it('excludes a frame less than half visible', () => {
    // 400 wide starting at x=800 in a 0..1000 view: only 200 of 400 shows = 50%.
    // Push it one pixel further so it drops below half.
    const frames = [frame('edge', { x: 801, y: 0 })]
    expect(visibleFrameIds(frames, view, canvas)).toEqual([])
  })

  it('never counts a non-active frame', () => {
    const frames = [frame('archived', { x: 0, y: 0, lifeState: 'archived' })]
    expect(visibleFrameIds(frames, view, canvas)).toEqual([])
  })
})

describe('verdictReviewWarning', () => {
  const winner = frame('w', { kind: 'playable-option', unitId: 'u' })
  const sibling = frame('s', { kind: 'playable-option', unitId: 'u', x: 500 })
  function summary(over: Partial<ReviewSummary> & { frameId: string }): ReviewSummary {
    return { visibleSeconds: 0, kitStatesTried: 0, playedLive: false, ...over }
  }

  it('warns when the winner was never played live', () => {
    const message = verdictReviewWarning([winner], [summary({ frameId: 'w', visibleSeconds: 10 })], 'u', 'w')
    expect(message).toContain('never played live')
  })

  it('warns when a sibling option went unreviewed', () => {
    const message = verdictReviewWarning([winner, sibling], [summary({ frameId: 'w', playedLive: true })], 'u', 'w')
    expect(message).toContain('1 other option was not reviewed')
  })

  it('is silent when the winner was played and every sibling reviewed', () => {
    const summaries = [summary({ frameId: 'w', playedLive: true }), summary({ frameId: 's', visibleSeconds: 5 })]
    expect(verdictReviewWarning([winner, sibling], summaries, 'u', 'w')).toBeNull()
  })
})
