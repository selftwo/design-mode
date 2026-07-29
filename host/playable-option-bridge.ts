import { createHash } from 'node:crypto'

// The host-owned side of the playable-option handshake: the one script the host
// injects into every served scratch HTML page, the strict content policy that
// ships with it, and the checks that keep agent-authored HTML honest. The
// message schema, hello builder, and ready-provenance check live in
// src/features/playable-option/ so the browser hook (item 1d) can share them
// without pulling node:crypto into the app bundle. This mirrors the live-review
// split (src schema/builder/provenance + host-side injected script).

// The static marker the generated HTML must carry so the host knows the file was
// written to be embedded as a playable option. The agent writes only this meta
// tag; the host adds the script at serve time.
export const PLAYABLE_BRIDGE_HOOK = '<meta name="design-mode-playable-bridge" content="1">'

// Attribute stamped on the injected script so a second serve does not add a
// second copy, and so the raw-HTML script ban can tell its own script apart.
const PLAYABLE_BRIDGE_SCRIPT_MARKER = 'data-design-mode-playable'

// The sole script the host injects. It answers the playable-hello handshake with
// playable-ready using the token and frame id carried in the iframe URL hash.
// Literals here mirror src/features/playable-option/playable-option-message.schema.ts;
// keep them in sync (schemaVersion 1, the two message types).
const PLAYABLE_BRIDGE_SCRIPT_BODY = `
(() => {
  const params = new URLSearchParams(location.hash.slice(1))
  const token = params.get('token')
  const frameId = params.get('frameId')
  if (!token || !frameId) return
  addEventListener('message', (event) => {
    const data = event.data
    if (!data || data.type !== 'design-review/playable-hello') return
    if (data.schemaVersion !== 1 || data.token !== token || data.frameId !== frameId) return
    if (!event.source || typeof event.source.postMessage !== 'function') return
    event.source.postMessage({ type: 'design-review/playable-ready', schemaVersion: 1, frameId, token }, event.origin)
  })
})()
`

export const PLAYABLE_BRIDGE_SCRIPT = `<script ${PLAYABLE_BRIDGE_SCRIPT_MARKER}>${PLAYABLE_BRIDGE_SCRIPT_BODY}</script>`

// A CSP hash source over the exact injected script text, so the strict policy
// can allow that one inline script and nothing else. Computed from the same
// string that is injected, never hand-written, so the two cannot drift.
function injectedScriptCspSource(): string {
  const digest = createHash('sha256').update(PLAYABLE_BRIDGE_SCRIPT_BODY, 'utf8').digest('base64')
  return `'sha256-${digest}'`
}

// The content policy the host sends with every served scratch HTML page. Blocks
// everything by default, allows inline styles (lo-fi options are inline-styled),
// and allows only the one injected bridge script by hash. frame-ancestors 'self'
// lets the canvas app, served from the same host origin, embed the page.
export const PLAYABLE_SCRATCH_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  `script-src ${injectedScriptCspSource()}`,
  "script-src-attr 'none'",
  "style-src 'unsafe-inline'",
  "connect-src 'none'",
  "font-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join('; ')

export function htmlHasPlayableBridgeHook(html: string): boolean {
  return /<meta\s+[^>]*name=["']design-mode-playable-bridge["'][^>]*>/i.test(html)
}

// True when the raw (pre-injection) HTML contains an author-written script. The
// host owns the only script; anything else is rejected so agent code never runs
// under the bridge's CSP hash.
export function htmlHasAuthoredScript(html: string): boolean {
  return /<script[\s>]/i.test(html)
}

// Whether a raw scratch HTML file is safe to serve as a playable option.
export function checkPlayableScratchHtml(html: string): { ok: true } | { ok: false; reason: string } {
  if (!htmlHasPlayableBridgeHook(html)) {
    return { ok: false, reason: `missing ${PLAYABLE_BRIDGE_HOOK}` }
  }
  // Injection is suppressed when the marker is already present, so raw HTML
  // that carries the literal anywhere (a class name, visible text) would be
  // served with no bridge script and the handshake would never complete.
  // Reserving the literal here means every accepted artifact gets the script.
  if (html.includes(PLAYABLE_BRIDGE_SCRIPT_MARKER)) {
    return {
      ok: false,
      reason: `the text "${PLAYABLE_BRIDGE_SCRIPT_MARKER}" is reserved for the host-injected bridge script and may not appear in authored HTML`,
    }
  }
  if (htmlHasAuthoredScript(html)) {
    return { ok: false, reason: 'authored <script> is not allowed; the host injects the only script' }
  }
  return { ok: true }
}

// Adds the bridge script once. Idempotent: a page that already carries the
// marker is returned unchanged.
export function injectPlayableBridge(html: string): string {
  if (html.includes(PLAYABLE_BRIDGE_SCRIPT_MARKER)) return html
  return html.includes('</body>')
    ? html.replace('</body>', `${PLAYABLE_BRIDGE_SCRIPT}</body>`)
    : html + PLAYABLE_BRIDGE_SCRIPT
}
