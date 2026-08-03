import {
  BOARD_SCHEMA_VERSION,
  type BoardDocument,
  type ReviewAnnotation,
} from '@/features/review-board/model/board-document.schema'

function svgDataUrl(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844"><rect width="100%" height="100%" fill="#fbfaf8"/><text x="50%" y="50%" text-anchor="middle" font-family="system-ui" font-size="24" fill="#35322c">${label}</text></svg>`
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

export function createMWebTestBoard(): BoardDocument {
  const frame = {
    id: 'frame-home',
    label: 'Home',
    route: '/',
    viewport: { width: 1440, height: 900 },
    x: 0,
    y: 0,
    width: 390,
    height: 844,
    aspectRatio: 390 / 844,
    screenshotPath: 'screens/home.svg',
    screenshotDataUrl: svgDataUrl('Home'),
    refreshedScreenshotDataUrl: svgDataUrl('Home rev 2'),
    captureHash: 'home-revision-1',
    revision: 1,
    elements: [],
    kind: 'captured-route' as const,
    lifeState: 'active' as const,
  }
  const annotation: ReviewAnnotation = {
    kind: 'review',
    id: 'annotation-hero',
    frameId: frame.id,
    role: 'review',
    status: 'draft',
    instruction: 'Hero measure runs the full row. Cap it and let the cards carry the width.',
    intent: 'distill',
    anchor: [0.55, 0.22],
    mark: { kind: 'circle', points: [[0.45, 0.15], [0.65, 0.3]] },
    replies: [],
    createdAt: '2026-07-17T11:58:00.000Z',
    madeAgainstCaptureHash: frame.captureHash,
    madeAgainstRevision: frame.revision,
  }
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    boardId: 'smalltools — landing review',
    documentRevision: 1,
    camera: { worldX: 0, worldY: 0, zoom: 1 },
    frames: [frame],
    annotations: [annotation],
    units: [],
    zones: [],
    verdicts: [],
    reviewSummaries: [],
  }
}
