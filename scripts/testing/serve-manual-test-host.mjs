import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'

const host = '127.0.0.1'
const port = Number(process.env.MANUAL_HOST_PORT ?? 5180)
const root = path.resolve('test-fixtures/manual-host')

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', `http://${host}:${port}`).pathname
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1)
  const file = path.resolve(root, relative)
  if (!file.startsWith(`${root}${path.sep}`) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[path.extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  })
  createReadStream(file).pipe(response)
})

server.listen(port, host, () => {
  process.stdout.write(`Manual test host listening at http://${host}:${port}\n`)
})
