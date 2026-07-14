import { describe, expect, it } from 'vitest'
import { createPressureTestBoard } from '@/test-support/create-pressure-test-board'
import { applyHostCaptureRefresh } from './apply-host-capture-refresh'

describe('applyHostCaptureRefresh', () => {
  it('increments revision once and replaces capture references', () => {
    const document = createPressureTestBoard()
    const frame = document.frames[0]!
    const result = applyHostCaptureRefresh(document, {
      frameId: frame.id,
      screenshotPath: 'screens/new.svg',
      screenshotDataUrl: 'data:new',
      refreshedScreenshotDataUrl: 'data:refreshed',
      captureHash: 'capture-revision-2',
    })
    if ('error' in result) throw new Error(result.error)
    const updated = result.frames.find((item) => item.id === frame.id)!
    expect(updated.revision).toBe(frame.revision + 1)
    expect(updated.screenshotPath).toBe('screens/new.svg')
    expect(updated.captureHash).toBe('capture-revision-2')
    expect(result.annotations).toEqual(document.annotations)
  })

  it('rejects unknown frames', () => {
    const document = createPressureTestBoard()
    expect(applyHostCaptureRefresh(document, {
      frameId: 'missing',
      screenshotPath: 'x',
      screenshotDataUrl: 'a',
      refreshedScreenshotDataUrl: 'b',
      captureHash: 'c',
    })).toEqual({ error: 'Unknown frame missing' })
  })
})