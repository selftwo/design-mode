import { BOARD_SCHEMA_VERSION, type BoardDocument, type ScreenFrame } from '../src/features/review-board/model/board-document.schema.ts'

const FRAME_GAP = 80

// A fresh capture must never destroy review work. Existing frames keep their
// canvas position, size, and label; only capture identity moves forward, and
// only when the pixels actually changed, so stale marking stays truthful.
export function mergeCapturedFrames(
  existing: BoardDocument | null,
  captured: ScreenFrame[],
  boardId: string,
): BoardDocument {
  if (!existing) {
    let cursorX = 0
    const frames = captured.map((frame) => {
      const placed = { ...frame, x: cursorX, y: 0 }
      cursorX += frame.width + FRAME_GAP
      return placed
    })
    return {
      schemaVersion: BOARD_SCHEMA_VERSION,
      boardId,
      camera: { worldX: 0, worldY: -80, zoom: 0.8 },
      frames,
      annotations: [],
    }
  }

  const capturedById = new Map(captured.map((frame) => [frame.id, frame]))
  const refreshed = existing.frames.map((frame) => {
    const update = capturedById.get(frame.id)
    if (!update) return frame
    capturedById.delete(frame.id)
    if (update.captureHash === frame.captureHash) return frame
    return {
      ...frame,
      viewport: update.viewport,
      aspectRatio: update.aspectRatio,
      height: frame.width / update.aspectRatio,
      screenshotPath: update.screenshotPath,
      screenshotDataUrl: update.screenshotDataUrl,
      refreshedScreenshotDataUrl: update.refreshedScreenshotDataUrl,
      captureHash: update.captureHash,
      revision: frame.revision + 1,
      elements: update.elements,
    }
  })

  let cursorX = refreshed.reduce((edge, frame) => Math.max(edge, frame.x + frame.width), 0)
  const appended = [...capturedById.values()].map((frame) => {
    cursorX += FRAME_GAP
    const placed = { ...frame, x: cursorX, y: 0 }
    cursorX += frame.width
    return placed
  })

  return { ...existing, frames: [...refreshed, ...appended] }
}
