import {
  BOARD_SCHEMA_VERSION,
  BoardDocumentSchema,
  type BoardDocument,
  type ReviewAnnotation,
  type ScreenFrame,
} from '@/features/review-board/model/board-document.schema'

const aspects = [16 / 9, 4 / 3, 9 / 16]

function svgDataUrl(width: number, height: number, label: string, hue: number, revision = 1): string {
  const safeLabel = label.replace(/[<>&\"']/g, '')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="hsl(${hue} 44% ${revision === 1 ? '92%' : '82%'})"/><rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="20" fill="white" stroke="hsl(${hue} 42% 48%)" stroke-width="3"/><text x="50%" y="45%" text-anchor="middle" font-family="system-ui" font-size="${Math.max(22, Math.min(width, height) / 12)}" fill="#19233a">${safeLabel}</text><text x="50%" y="58%" text-anchor="middle" font-family="system-ui" font-size="18" fill="#53617f">capture ${revision}</text></svg>`
  const encoded = btoa(unescape(encodeURIComponent(svg)))
  return `data:image/svg+xml;base64,${encoded}`
}

function fixtureFrame(index: number): ScreenFrame {
  const sizeClass = index < 40 ? 'small' : index < 48 ? 'medium' : 'large'
  const intrinsicWidth = sizeClass === 'small' ? 640 : sizeClass === 'medium' ? 1280 : 2560
  const aspectRatio = aspects[index % aspects.length] ?? 16 / 9
  const intrinsicHeight = Math.round(intrinsicWidth / aspectRatio)
  const displayWidth = sizeClass === 'small' ? 240 : sizeClass === 'medium' ? 360 : 480
  const displayHeight = displayWidth / aspectRatio
  const hue = (index * 43) % 360
  return {
    id: `frame-${String(index).padStart(2, '0')}`,
    label: `Screen ${String(index).padStart(2, '0')}`,
    route: `/fixture/${index}`,
    viewport: { width: intrinsicWidth, height: intrinsicHeight },
    x: (index % 10) * 560,
    y: Math.floor(index / 10) * 720,
    width: displayWidth,
    height: displayHeight,
    aspectRatio,
    screenshotPath: `screens/frame-${String(index).padStart(2, '0')}.svg`,
    screenshotDataUrl: svgDataUrl(intrinsicWidth, intrinsicHeight, `Screen ${index}`, hue),
    refreshedScreenshotDataUrl: svgDataUrl(intrinsicWidth, intrinsicHeight, `Screen ${index}`, hue, 2),
    captureHash: `fixture-frame-${index}-revision-1`,
    revision: 1,
    elements: [],
  }
}

function fixtureAnnotations(frames: ScreenFrame[]): ReviewAnnotation[] {
  const annotations: ReviewAnnotation[] = []
  for (let index = 0; index < 10; index += 1) {
    annotations.push({
      id: `annotation-${index}`,
      frameId: frames[index]?.id ?? 'frame-00',
      status: 'draft',
      instruction: `Review fixture note ${index}`,
      anchor: [0.24 + index * 0.035, 0.32],
      mark: index % 2 === 0 ? { kind: 'circle', points: [[0.16, 0.2], [0.46, 0.48]] } : null,
      createdAt: '2026-07-13T00:00:00.000Z',
      madeAgainstCaptureHash: frames[index]?.captureHash ?? frames[0]!.captureHash,
      madeAgainstRevision: frames[index]?.revision ?? frames[0]!.revision,
    })
  }
  for (let index = 0; index < 20; index += 1) {
    const column = index % 5
    const row = Math.floor(index / 5)
    const x = 0.06 + column * 0.18
    const y = 0.08 + row * 0.2
    annotations.push({
      id: `stress-${index}`,
      frameId: 'frame-00',
      status: 'draft',
      instruction: `Stress mark ${index}`,
      anchor: [x + 0.04, y + 0.04],
      mark: { kind: 'circle', points: [[x, y], [x + 0.09, y + 0.08]] },
      createdAt: '2026-07-13T00:00:00.000Z',
      madeAgainstCaptureHash: frames[0]!.captureHash,
      madeAgainstRevision: frames[0]!.revision,
    })
  }
  return annotations
}

export function createPressureTestBoard(): BoardDocument {
  const frames = Array.from({ length: 50 }, (_, index) => fixtureFrame(index))
  return BoardDocumentSchema.parse({
    schemaVersion: BOARD_SCHEMA_VERSION,
    boardId: 'canvas-pressure-test',
    camera: { worldX: -200, worldY: -120, zoom: 0.7 },
    frames,
    annotations: fixtureAnnotations(frames),
  })
}
