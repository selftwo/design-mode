// THROWAWAY PROTOTYPE — Item 1 of docs/plans/canvas-lofi-option-studio-2026-07-21.md.
//
// Goal: feel the "generate lo-fi options -> compare -> pick -> hand off" loop
// end to end before building the real generation + host-capture path. Nothing
// here is wired to an agent or the host: three lo-fi HTML options are hardcoded,
// rendered into frames via an SVG <foreignObject> data URL so the existing
// canvas (drag, resize, marks) works unchanged, and the handoff payload is built
// but only shown, not dispatched. Delete this folder when the real loop lands.

import type { BoardDocument, ReviewAnnotation, ScreenFrame } from '../model/board-document.schema'

const PROTO_FLAG = 'lofi'
const OPTION_VIEWPORT = { width: 480, height: 600 } as const
const DISPLAY_WIDTH = 420
const OPTION_GAP = 80

export function isProtoLofiEnabled(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get('proto') === PROTO_FLAG
}

// A lo-fi option as the agent would eventually emit it: a self-contained bit of
// HTML. Kept as XHTML (self-closed tags, quoted attrs) so it renders inside an
// SVG <foreignObject>.
interface LofiOption {
  label: string
  html: string
}

const CARD_STYLE =
  'box-sizing:border-box;width:100%;height:100%;padding:32px;background:#f4f4f5;' +
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#18181b;"
const FIELD = 'height:40px;border:1px solid #d4d4d8;border-radius:8px;background:#ffffff;'
const LABEL = 'font-size:13px;color:#52525b;margin:0 0 6px;'
const BTN = 'height:44px;border-radius:8px;background:#18181b;color:#ffffff;'
const BTN_TEXT =
  'display:flex;align-items:center;justify-content:center;height:100%;font-size:15px;font-weight:600;'

const LOFI_OPTIONS: LofiOption[] = [
  {
    label: 'Sign-in — Option A (stacked)',
    html:
      `<div style="${CARD_STYLE}">` +
      '<h1 style="font-size:22px;margin:0 0 24px;">Sign in</h1>' +
      `<p style="${LABEL}">Email</p><div style="${FIELD}margin-bottom:16px;"></div>` +
      `<p style="${LABEL}">Password</p><div style="${FIELD}margin-bottom:24px;"></div>` +
      `<div style="${BTN}"><div style="${BTN_TEXT}">Continue</div></div>` +
      '<p style="font-size:13px;color:#71717a;text-align:center;margin:20px 0 0;">Forgot password?</p>' +
      '</div>',
  },
  {
    label: 'Sign-in — Option B (card + social)',
    html:
      `<div style="${CARD_STYLE}display:flex;flex-direction:column;align-items:center;">` +
      '<div style="width:48px;height:48px;border-radius:12px;background:#18181b;margin-bottom:20px;"></div>' +
      '<h1 style="font-size:20px;margin:0 0 4px;">Welcome back</h1>' +
      '<p style="font-size:13px;color:#71717a;margin:0 0 24px;">Sign in to continue</p>' +
      `<div style="${FIELD}width:100%;margin-bottom:12px;"></div>` +
      `<div style="${FIELD}width:100%;margin-bottom:20px;"></div>` +
      `<div style="${BTN}width:100%;margin-bottom:12px;"><div style="${BTN_TEXT}">Sign in</div></div>` +
      '<div style="height:44px;width:100%;border:1px solid #d4d4d8;border-radius:8px;background:#ffffff;">' +
      `<div style="${BTN_TEXT}color:#18181b;">Continue with Google</div></div>` +
      '</div>',
  },
  {
    label: 'Sign-in — Option C (split header)',
    html:
      `<div style="${CARD_STYLE}display:flex;flex-direction:column;">` +
      '<div style="background:#18181b;color:#ffffff;border-radius:12px;padding:24px;margin-bottom:24px;">' +
      '<h1 style="font-size:22px;margin:0 0 8px;">Members</h1>' +
      '<p style="font-size:13px;color:#a1a1aa;margin:0;">One account for everything.</p></div>' +
      `<p style="${LABEL}">Email</p><div style="${FIELD}margin-bottom:16px;"></div>` +
      `<p style="${LABEL}">Password</p><div style="${FIELD}margin-bottom:24px;"></div>` +
      `<div style="${BTN}"><div style="${BTN_TEXT}">Log in</div></div>` +
      '</div>',
  },
]

function htmlToSvgDataUrl(html: string, width: number, height: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    '<foreignObject width="100%" height="100%">' +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;">${html}</div>` +
    '</foreignObject></svg>'
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export interface ProtoLofiSeed {
  document: BoardDocument
  // frameId -> the option's source HTML, so the handoff payload can carry real code.
  optionHtml: Record<string, string>
}

// Build a board seeded with the three lo-fi options laid out in a row, plus the
// html map used by the handoff payload. Runs once per session behind the flag.
export function buildProtoLofiBoard(now: number = Date.now()): ProtoLofiSeed {
  const aspectRatio = OPTION_VIEWPORT.width / OPTION_VIEWPORT.height
  const width = DISPLAY_WIDTH
  const height = width / aspectRatio
  const optionHtml: Record<string, string> = {}

  const frames: ScreenFrame[] = LOFI_OPTIONS.map((option, index) => {
    const id = `lofi-option-${index + 1}`
    const dataUrl = htmlToSvgDataUrl(option.html, OPTION_VIEWPORT.width, OPTION_VIEWPORT.height)
    optionHtml[id] = option.html
    return {
      id,
      label: option.label,
      route: `lofi:${id}`,
      viewport: { ...OPTION_VIEWPORT },
      x: index * (width + OPTION_GAP),
      y: 0,
      width,
      height,
      aspectRatio,
      screenshotPath: `lofi/${id}.svg`,
      screenshotDataUrl: dataUrl,
      refreshedScreenshotDataUrl: dataUrl,
      captureHash: `${id}-${now}`,
      revision: 1,
      elements: [],
      kind: 'option-snapshot',
      lifeState: 'active',
      unitId: 'proto-set',
    }
  })

  return {
    document: {
      schemaVersion: 2,
      boardId: `proto-lofi-${now}`,
      documentRevision: 1,
      camera: { worldX: 0, worldY: 0, zoom: 1 },
      frames,
      annotations: [],
      units: [
        {
          id: 'proto-set',
          label: 'Sign-in options',
          brief: 'Compare the hardcoded prototype options',
          rules: [],
          dependsOnUnitIds: [],
          state: 'open',
        },
      ],
      zones: [],
      verdicts: [],
      reviewSummaries: [],
    },
    optionHtml,
  }
}

export interface LofiHandoffPayload {
  kind: 'lofi-handoff'
  chosenOption: { frameId: string; label: string; html: string }
  marks: ReviewAnnotation[]
  // Stubbed: the real loop (Item 6) will let the user name a target file/route.
  target: string
}

// The artifact you would hand to an agent: the picked option's real HTML, the
// marks you left on it, and where to build it for real.
export function buildLofiHandoffPayload(
  document: BoardDocument,
  preferredFrameId: string,
  optionHtml: Record<string, string>,
): LofiHandoffPayload | null {
  const frame = document.frames.find((item) => item.id === preferredFrameId)
  if (!frame) return null
  return {
    kind: 'lofi-handoff',
    chosenOption: {
      frameId: frame.id,
      label: frame.label,
      html: optionHtml[frame.id] ?? '',
    },
    marks: document.annotations.filter((annotation) => annotation.frameId === preferredFrameId),
    target: 'src/… (stub — the real loop lets you name the target file/route)',
  }
}
