import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'

const host = '127.0.0.1'
const port = Number(process.env.FIXTURE_PORT ?? 5199)
const root = path.resolve('test-fixtures')
const allowedFrameAncestors = [
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
].join(' ')

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', `http://${host}:${port}`).pathname
  const relative = pathname === '/' ? 'live-review.html' : pathname.slice(1)
  const file = path.resolve(root, relative)
  if (!file.startsWith(`${root}${path.sep}`) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }

  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': `default-src 'self' 'unsafe-inline'; frame-ancestors ${allowedFrameAncestors}`,
    'Cache-Control': 'no-store',
  })
  createReadStream(file).pipe(response)
})

server.listen(port, host, () => {
  process.stdout.write(`Live review fixture listening at http://${host}:${port}\n`)
})
