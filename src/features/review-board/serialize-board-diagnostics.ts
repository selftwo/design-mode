import type { BoardDocument } from './model/board-document.schema'

export function serializeBoardDiagnostics(document: BoardDocument): string {
  return JSON.stringify({
    camera: document.camera,
    frames: document.frames.map(({
      id,
      x,
      y,
      width,
      height,
      aspectRatio,
      revision,
      captureHash,
      screenshotPath,
    }) => ({
      id,
      x,
      y,
      width,
      height,
      aspectRatio,
      revision,
      captureHash,
      screenshotPath,
    })),
    annotations: document.annotations.map(({
      id,
      frameId,
      instruction,
      anchor,
      mark,
      madeAgainstCaptureHash,
      madeAgainstRevision,
    }) => ({
      id,
      frameId,
      instruction,
      anchor,
      mark,
      madeAgainstCaptureHash,
      madeAgainstRevision,
    })),
  })
}