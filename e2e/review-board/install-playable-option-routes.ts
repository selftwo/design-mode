import type { Page } from '@playwright/test'
import { injectPlayableBridge, PLAYABLE_SCRATCH_CONTENT_SECURITY_POLICY } from '../../host/playable-option-bridge'
import type { BoardDocument, ScreenFrame } from '../../src/features/review-board/model/board-document.schema'
import { ensureZonesForUnit } from '../../src/features/review-board/model/ensure-zones-for-unit'

const HOOK = '<meta name="design-mode-playable-bridge" content="1">'
const DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const ARTIFACT_HASH = 'a'.repeat(64)
const PROJECT = 'test-project'
const OPTION_SET = 'test-set'

// A no-script option page: it carries the bridge hook and a pure-HTML <details>
// control, so we can prove pointer ownership (play vs review) without any
// authored script. The host injects the only script, exactly as in production.
function optionHtml(label: string): string {
  return [
    '<!doctype html><html><head>',
    HOOK,
    '<style>body{font-family:system-ui;margin:0;padding:16px}.more{display:none}details[open] .more{display:block}',
    'html[data-kit-expand="true"] .more{display:block}</style>',
    '</head><body>',
    `<h1>${label}</h1>`,
    '<details><summary class="opt-summary">Details</summary><p class="more opt-more">Expanded</p></details>',
    '</body></html>',
  ].join('')
}

// Intercepts the same-origin scratch route the host would serve, injecting the
// real bridge and strict CSP. The iframe is sandboxed by the app, so it still
// runs at an opaque origin; only the serving side is faked.
export async function installPlayableOptionRoutes(page: Page) {
  await page.route(`**/scratch/${PROJECT}/${OPTION_SET}/option-*.html`, async (route) => {
    const url = new URL(route.request().url())
    const name = url.pathname.split('/').pop() ?? 'option'
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      headers: {
        'content-security-policy': PLAYABLE_SCRATCH_CONTENT_SECURITY_POLICY,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
      body: injectPlayableBridge(optionHtml(name)),
    })
  })
}

function playableFrame(index: number): ScreenFrame {
  const id = `p${index}`
  return {
    id,
    label: `Option ${index}`,
    route: `/scratch/${PROJECT}/${OPTION_SET}/option-${index}.html`,
    viewport: { width: 1440, height: 900 },
    x: index * 260,
    y: 0,
    width: 220,
    height: 137.5,
    aspectRatio: 1.6,
    screenshotPath: `screens/${id}.png`,
    screenshotDataUrl: DATA_URL,
    refreshedScreenshotDataUrl: DATA_URL,
    captureHash: `${id}-hash`,
    revision: 1,
    elements: [],
    kind: 'playable-option',
    lifeState: 'active',
    unitId: 'unit-1',
    liveSource: {
      kind: 'scratch-html',
      path: `/scratch/${PROJECT}/${OPTION_SET}/option-${index}.html`,
      protocolVersion: 1,
      artifactHash: ARTIFACT_HASH,
    },
    kit: {
      manifest: {
        manifestVersion: 1,
        controls: [{ kind: 'toggle', id: 'expand', label: 'Expanded', default: false }],
      },
      state: { expand: false },
    },
  }
}

// A board of playable options in one row under one open unit. `count` above the
// cap (6) exercises the live-mount limit. Zones are ensured so drag targets exist.
export function buildPlayableBoard(count: number): BoardDocument {
  return ensureZonesForUnit({
    schemaVersion: 2,
    boardId: 'playable-board',
    documentRevision: 1,
    camera: { worldX: 0, worldY: 0, zoom: 0.6 },
    frames: Array.from({ length: count }, (_, index) => playableFrame(index)),
    annotations: [],
    units: [{ id: 'unit-1', label: 'Options', brief: 'Pick one', rules: [], dependsOnUnitIds: [], state: 'open' }],
    zones: [],
    verdicts: [],
    reviewSummaries: [],
  }, 'unit-1')
}
