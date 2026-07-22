import { describe, expect, it } from 'vitest'
import { MAX_MOUNTED_PLAYABLE_OPTIONS, selectLivePlayableFrameIds, type MountPolicyInput } from './playable-option-mount-policy'
import type { ScreenFrame } from '../review-board/model/board-document.schema'

function frame(id: string, x: number, overrides: Partial<ScreenFrame> = {}): ScreenFrame {
  return {
    id,
    label: id,
    route: `/${id}`,
    viewport: { width: 1440, height: 900 },
    x,
    y: 0,
    width: 420,
    height: 262.5,
    aspectRatio: 1.6,
    screenshotPath: `screens/${id}.png`,
    screenshotDataUrl: 'data:image/png;base64,x',
    refreshedScreenshotDataUrl: 'data:image/png;base64,x',
    captureHash: `${id}-hash`,
    revision: 1,
    elements: [],
    kind: 'playable-option',
    lifeState: 'active',
    unitId: 'unit-1',
    ...overrides,
  }
}

// A 1000x800 canvas at zoom 1, origin at world (0,0): world view is [0,0]..[1000,800].
function input(frames: ScreenFrame[], overrides: Partial<MountPolicyInput> = {}): MountPolicyInput {
  return {
    frames,
    view: { x: 0, y: 0, zoom: 1 },
    canvasSize: { width: 1000, height: 800 },
    selectedFrameId: null,
    focusedFrameId: null,
    ...overrides,
  }
}

describe('selectLivePlayableFrameIds', () => {
  it('mounts only playable options, not screenshots or captured routes', () => {
    const result = selectLivePlayableFrameIds(input([
      frame('play', 100),
      frame('shot', 200, { kind: 'option-snapshot', liveSource: undefined, kit: undefined }),
      frame('route', 300, { kind: 'captured-route', unitId: undefined }),
      frame('image', 400, { kind: 'imported-image', unitId: undefined }),
    ]))
    expect([...result]).toEqual(['play'])
  })

  it('excludes archived and killed options, keeps active and locked', () => {
    const result = selectLivePlayableFrameIds(input([
      frame('active', 100, { lifeState: 'active' }),
      frame('locked', 200, { lifeState: 'locked' }),
      frame('archived', 300, { lifeState: 'archived' }),
      frame('killed', 400, { lifeState: 'killed' }),
    ]))
    expect(result.has('active')).toBe(true)
    expect(result.has('locked')).toBe(true)
    expect(result.has('archived')).toBe(false)
    expect(result.has('killed')).toBe(false)
  })

  it('includes an option within one screen of margin but not one beyond it', () => {
    // view width is 1000; expanded right edge is 2000.
    const result = selectLivePlayableFrameIds(input([
      frame('near', 1500),
      frame('far', 2100),
    ]))
    expect(result.has('near')).toBe(true)
    expect(result.has('far')).toBe(false)
  })

  it('always keeps the selected option even when it is far outside the margin', () => {
    const result = selectLivePlayableFrameIds(input([frame('offscreen', 9000)], { selectedFrameId: 'offscreen' }))
    expect(result.has('offscreen')).toBe(true)
  })

  it('ranks in-view options ahead of margin-only options under the cap', () => {
    const frames = [
      frame('margin', 1500),
      frame('inview', 100),
    ]
    const result = selectLivePlayableFrameIds(input(frames, { cap: 1 }))
    expect([...result]).toEqual(['inview'])
  })

  it('breaks distance ties by document order', () => {
    // Two frames equidistant from the view center; document order decides.
    const frames = [
      frame('second', 400),
      frame('first', 400),
    ]
    const result = selectLivePlayableFrameIds(input(frames, { cap: 1 }))
    expect([...result]).toEqual(['second'])
  })

  it('never mounts more than the cap', () => {
    const frames = Array.from({ length: 10 }, (_, index) => frame(`p${index}`, index * 30))
    const result = selectLivePlayableFrameIds(input(frames))
    expect(result.size).toBe(MAX_MOUNTED_PLAYABLE_OPTIONS)
  })

  it('with a zero-size canvas mounts only the forced selected or focused option', () => {
    const frames = [frame('a', 100), frame('b', 200)]
    const empty = input(frames, { canvasSize: { width: 0, height: 0 }, selectedFrameId: 'b' })
    expect([...selectLivePlayableFrameIds(empty)]).toEqual(['b'])
  })
})
