import type { BoardDocument, ScreenFrame } from '../model/board-document.schema'

export interface ImportedImage {
  name: string
  dataUrl: string
  width: number
  height: number
}

const IMPORTABLE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const UPLOAD_DISPLAY_WIDTH = 420
const UPLOAD_GAP = 80

export function listImportableImageFiles(files: Iterable<File>): File[] {
  return [...files].filter((file) => IMPORTABLE_TYPES.has(file.type))
}

export function readImageFile(file: File): Promise<ImportedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`${file.name} could not be read`))
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const image = new Image()
      image.onerror = () => reject(new Error(`${file.name} is not a decodable image`))
      image.onload = () => {
        if (image.naturalWidth < 1 || image.naturalHeight < 1) {
          reject(new Error(`${file.name} has no measurable size`))
          return
        }
        resolve({
          name: file.name,
          dataUrl,
          width: image.naturalWidth,
          height: image.naturalHeight,
        })
      }
      image.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
}

// Uploaded images join the board as regular screen frames: same annotation,
// export, and persistence path as captured screens. They are placed in a row
// to the right of the existing content so they never cover captured work.
export function buildUploadFrames(
  document: BoardDocument,
  images: ImportedImage[],
  now: number = Date.now(),
): ScreenFrame[] {
  let cursorX = document.frames.reduce((edge, frame) => Math.max(edge, frame.x + frame.width), 0)
  if (document.frames.length > 0) cursorX += UPLOAD_GAP
  const y = document.frames.reduce((top, frame) => Math.min(top, frame.y), 0)

  return images.map((image, index) => {
    const aspectRatio = image.width / image.height
    const width = UPLOAD_DISPLAY_WIDTH
    const height = width / aspectRatio
    const id = `upload-${now}-${index + 1}`
    const frame: ScreenFrame = {
      id,
      label: image.name.replace(/\.[a-z0-9]+$/i, '') || image.name,
      route: `uploaded:${image.name}`,
      viewport: { width: image.width, height: image.height },
      x: cursorX,
      y,
      width,
      height,
      aspectRatio,
      screenshotPath: `uploads/${image.name}`,
      screenshotDataUrl: image.dataUrl,
      refreshedScreenshotDataUrl: image.dataUrl,
      captureHash: `${id}-${image.width}x${image.height}`,
      revision: 1,
      elements: [],
    }
    cursorX += width + UPLOAD_GAP
    return frame
  })
}
