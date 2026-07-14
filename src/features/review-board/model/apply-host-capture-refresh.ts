import type { BoardDocument } from './board-document.schema'
import type { HostCaptureRefreshSuccessPayload } from '../host/host-live-message.schema'

export function applyHostCaptureRefresh(
  document: BoardDocument,
  payload: Pick<
    HostCaptureRefreshSuccessPayload,
    'frameId' | 'screenshotPath' | 'screenshotDataUrl' | 'refreshedScreenshotDataUrl' | 'captureHash'
  >,
): BoardDocument | { error: string } {
  const frame = document.frames.find((item) => item.id === payload.frameId)
  if (!frame) return { error: `Unknown frame ${payload.frameId}` }
  const nextRevision = frame.revision + 1
  return {
    ...document,
    frames: document.frames.map((item) => item.id === payload.frameId
      ? {
          ...item,
          revision: nextRevision,
          screenshotPath: payload.screenshotPath,
          screenshotDataUrl: payload.screenshotDataUrl,
          refreshedScreenshotDataUrl: payload.refreshedScreenshotDataUrl,
          captureHash: payload.captureHash,
        }
      : item),
  }
}