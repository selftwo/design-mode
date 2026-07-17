import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

// Injected into every proxied HTML page. It answers the canvas live-frame
// handshake (design-review/live-hello -> live-ready) using the token and frame
// id carried in the iframe URL hash, so any local web app becomes live
// reviewable without changing its source.
const LIVE_CLIENT_SCRIPT = `<script data-design-mode-live>
(() => {
  const params = new URLSearchParams(location.hash.slice(1))
  const token = params.get('token')
  const frameId = params.get('frameId')
  if (!token || !frameId) return
  addEventListener('message', (event) => {
    const data = event.data
    if (!data || data.type !== 'design-review/live-hello') return
    if (data.schemaVersion !== 1 || data.token !== token || data.frameId !== frameId) return
    if (!event.source || typeof event.source.postMessage !== 'function') return
    event.source.postMessage({ type: 'design-review/live-ready', schemaVersion: 1, frameId, token }, event.origin)
  })
})()
</script>`

// Headers that would stop the page from loading inside the review iframe or
// would no longer be truthful after injection.
const DROPPED_RESPONSE_HEADERS = new Set([
  'content-security-policy',
  'content-security-policy-report-only',
  'x-frame-options',
  'content-length',
])

export interface LiveReviewProxy {
  origin: string
  close: () => Promise<void>
}

// A dedicated proxy port per project keeps the target app's absolute asset
// paths working, which a path-prefixed proxy on the host port could not do.
export function startLiveReviewProxy(targetOrigin: string): Promise<LiveReviewProxy> {
  const target = new URL(targetOrigin)

  const handle = (incoming: IncomingMessage, outgoing: ServerResponse) => {
    const forwarded = httpRequest({
      hostname: target.hostname,
      port: target.port,
      path: incoming.url,
      method: incoming.method,
      headers: { ...incoming.headers, host: target.host },
    }, (upstream) => {
      const headers: Record<string, string | string[]> = {}
      for (const [name, value] of Object.entries(upstream.headers)) {
        if (value === undefined || DROPPED_RESPONSE_HEADERS.has(name.toLowerCase())) continue
        headers[name] = value
      }
      const contentType = String(upstream.headers['content-type'] ?? '')
      if (!contentType.includes('text/html')) {
        if (upstream.headers['content-length']) headers['content-length'] = upstream.headers['content-length']
        outgoing.writeHead(upstream.statusCode ?? 502, headers)
        upstream.pipe(outgoing)
        return
      }
      const chunks: Buffer[] = []
      upstream.on('data', (chunk) => chunks.push(chunk))
      upstream.on('end', () => {
        const html = Buffer.concat(chunks).toString('utf8')
        const injected = html.includes('</body>')
          ? html.replace('</body>', `${LIVE_CLIENT_SCRIPT}</body>`)
          : html + LIVE_CLIENT_SCRIPT
        outgoing.writeHead(upstream.statusCode ?? 502, headers)
        outgoing.end(injected)
      })
    })
    forwarded.on('error', () => {
      outgoing.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
      outgoing.end(`The live page at ${targetOrigin} is not answering.`)
    })
    incoming.pipe(forwarded)
  }

  return new Promise((resolve, reject) => {
    const server: Server = createServer(handle)
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Live proxy failed to bind a port'))
        return
      }
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(() => done())),
      })
    })
  })
}
