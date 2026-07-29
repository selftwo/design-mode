import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  PLAYABLE_BRIDGE_HOOK,
  PLAYABLE_BRIDGE_SCRIPT,
  PLAYABLE_SCRATCH_CONTENT_SECURITY_POLICY,
  checkPlayableScratchHtml,
  htmlHasAuthoredScript,
  htmlHasPlayableBridgeHook,
  injectPlayableBridge,
} from './playable-option-bridge.ts'

const validHtml = `<html><head>${PLAYABLE_BRIDGE_HOOK}</head><body><button>Go</button></body></html>`

describe('playable bridge HTML checks', () => {
  it('accepts HTML that carries the hook and no authored script', () => {
    expect(htmlHasPlayableBridgeHook(validHtml)).toBe(true)
    expect(htmlHasAuthoredScript(validHtml)).toBe(false)
    expect(checkPlayableScratchHtml(validHtml)).toEqual({ ok: true })
  })

  it('rejects HTML missing the bridge hook', () => {
    const result = checkPlayableScratchHtml('<html><head></head><body></body></html>')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('design-mode-playable-bridge')
  })

  it('rejects HTML with an author-written script', () => {
    const html = `<html><head>${PLAYABLE_BRIDGE_HOOK}</head><body><script>alert(1)</script></body></html>`
    expect(htmlHasAuthoredScript(html)).toBe(true)
    const result = checkPlayableScratchHtml(html)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('script')
  })

  it('rejects HTML carrying the reserved injected-script marker so injection is never suppressed', () => {
    const asClassName = `<html><head>${PLAYABLE_BRIDGE_HOOK}</head><body><p class="data-design-mode-playable">Hi</p></body></html>`
    const asText = `<html><head>${PLAYABLE_BRIDGE_HOOK}</head><body>data-design-mode-playable</body></html>`
    for (const html of [asClassName, asText]) {
      const result = checkPlayableScratchHtml(html)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toContain('data-design-mode-playable')
    }
  })
})

describe('injectPlayableBridge', () => {
  it('inserts the bridge script before </body>', () => {
    const injected = injectPlayableBridge(validHtml)
    expect(injected).toContain(PLAYABLE_BRIDGE_SCRIPT)
    expect(injected.indexOf(PLAYABLE_BRIDGE_SCRIPT)).toBeLessThan(injected.indexOf('</body>'))
  })

  it('appends the bridge script when there is no </body>', () => {
    const injected = injectPlayableBridge(`<div>${PLAYABLE_BRIDGE_HOOK}</div>`)
    expect(injected.endsWith(PLAYABLE_BRIDGE_SCRIPT)).toBe(true)
  })

  it('does not inject twice', () => {
    const once = injectPlayableBridge(validHtml)
    const twice = injectPlayableBridge(once)
    expect(twice).toBe(once)
    expect(twice.match(/data-design-mode-playable/g)).toHaveLength(1)
  })
})

describe('playable scratch content security policy', () => {
  it('blocks everything by default and allows only inline styles', () => {
    expect(PLAYABLE_SCRATCH_CONTENT_SECURITY_POLICY).toContain("default-src 'none'")
    expect(PLAYABLE_SCRATCH_CONTENT_SECURITY_POLICY).toContain("style-src 'unsafe-inline'")
    expect(PLAYABLE_SCRATCH_CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'self'")
  })

  it('never allows unsafe-inline scripts', () => {
    const scriptDirective = PLAYABLE_SCRATCH_CONTENT_SECURITY_POLICY
      .split('; ')
      .find((directive) => directive.startsWith('script-src '))
    expect(scriptDirective).toBeDefined()
    expect(scriptDirective).not.toContain("'unsafe-inline'")
  })

  it('allows exactly the injected script by its sha256 hash', () => {
    const body = PLAYABLE_BRIDGE_SCRIPT.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
    const digest = createHash('sha256').update(body, 'utf8').digest('base64')
    expect(PLAYABLE_SCRATCH_CONTENT_SECURITY_POLICY).toContain(`script-src 'sha256-${digest}'`)
  })
})
