import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { BoardDocumentSchema } from '../src/features/review-board/model/board-document.schema.ts'
import {
  AgentListSchema,
  BoardResponseSchema,
  DispatchRequestSchema,
  LiveSessionResponseSchema,
  ProjectRegistrationSchema,
  type AgentRun,
  type Project,
} from '../src/features/local-host/host-api.schema.ts'
import { resolveAgentCommand, probeAgentAvailability, type AgentCommandSpec } from './agent-adapters.ts'
import { buildAgentPrompt } from './build-agent-prompt.ts'
import { captureProjectBoard, ensureDevServer, type DevServerHandle } from './capture-project-board.ts'
import { createHostDataStore, defaultDataDir } from './host-data-store.ts'
import { createHostEventBus } from './host-event-bus.ts'
import { startLiveReviewProxy, type LiveReviewProxy } from './live-review-proxy.ts'
import { spawnEnvironment } from './spawn-environment.ts'

const CONTEXT_FILE_NAMES = ['DESIGN.md', 'PRODUCT.md', 'AGENTS.md', 'CLAUDE.md', 'README.md']
const OUTPUT_TAIL_LIMIT = 4_000
const BODY_LIMIT_BYTES = 128 * 1024 * 1024

const STATIC_CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
}

const LiveSessionRequestSchema = z.object({ frameId: z.string().min(1) })
const RefreshRequestSchema = z.object({ frameId: z.string().min(1) })

export interface DesignModeHostOptions {
  port?: number
  dataDir?: string
  distDir?: string
  // Test seam: replaces vendor CLIs and skips the post-run browser capture.
  agentCommands?: Partial<Record<'claude' | 'codex' | 'cursor', AgentCommandSpec>>
  recaptureAfterRun?: boolean
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > BODY_LIMIT_BYTES) {
        reject(new Error('Request body too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  const body = JSON.stringify(payload)
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(body)
}

function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    const first = error.issues[0]
    return first ? `${first.path.join('.') || 'request'}: ${first.message}` : 'Invalid request'
  }
  return error instanceof Error ? error.message : 'Unexpected host error'
}

export async function startDesignModeHost(options: DesignModeHostOptions = {}) {
  const store = createHostDataStore(options.dataDir ?? defaultDataDir())
  const events = createHostEventBus()
  const distDir = options.distDir ?? fileURLToPath(new URL('../dist', import.meta.url))
  const recaptureAfterRun = options.recaptureAfterRun ?? true
  const devServers = new Map<string, Promise<DevServerHandle>>()
  const liveProxies = new Map<string, Promise<LiveReviewProxy>>()
  const activeRuns = new Map<string, AgentRun>()

  function devServerFor(project: Project): Promise<DevServerHandle> {
    let handle = devServers.get(project.id)
    if (!handle) {
      handle = ensureDevServer(project)
      handle.catch(() => devServers.delete(project.id))
      devServers.set(project.id, handle)
    }
    return handle
  }

  function liveProxyFor(project: Project): Promise<LiveReviewProxy> {
    let proxy = liveProxies.get(project.id)
    if (!proxy) {
      proxy = devServerFor(project).then((server) => startLiveReviewProxy(server.url))
      proxy.catch(() => liveProxies.delete(project.id))
      liveProxies.set(project.id, proxy)
    }
    return proxy
  }

  function updateRun(run: AgentRun) {
    activeRuns.set(run.id, run)
    store.writeRun(run)
    events.publish({ type: 'run-updated', run })
  }

  async function recaptureProject(project: Project) {
    events.publish({ type: 'capture-started', projectId: project.id })
    try {
      const devServer = await devServerFor(project)
      const board = await captureProjectBoard(project, devServer.url, store.readBoard(project.id))
      store.writeBoard(project.id, board)
      events.publish({ type: 'board-updated', projectId: project.id })
    } catch (error) {
      events.publish({ type: 'capture-failed', projectId: project.id, error: errorMessage(error) })
    }
  }

  function launchAgentRun(project: Project, dispatch: z.infer<typeof DispatchRequestSchema>) {
    const run: AgentRun = {
      id: randomUUID(),
      projectId: project.id,
      agent: dispatch.agent,
      status: 'queued',
      annotationIds: dispatch.batch.annotations.map((annotation) => annotation.id),
      startedAt: new Date().toISOString(),
      outputTail: '',
    }
    updateRun(run)

    const assetDir = store.runAssetDir(run.id)
    const screenshotDirectory = path.join(assetDir, 'screens')
    mkdirSync(screenshotDirectory, { recursive: true })
    const board = store.readBoard(project.id)
    for (const annotation of dispatch.batch.annotations) {
      const frame = board?.frames.find((item) => item.id === annotation.frameId)
      const base64 = frame?.screenshotDataUrl.split(',')[1]
      if (base64) writeFileSync(path.join(screenshotDirectory, `${annotation.frameId}.png`), Buffer.from(base64, 'base64'))
    }
    const contextFiles = readProjectContext(project)
    const prompt = buildAgentPrompt({ project, batch: dispatch.batch, contextFiles, screenshotDirectory })
    writeFileSync(path.join(assetDir, 'prompt.md'), prompt)
    writeFileSync(path.join(assetDir, 'batch.json'), JSON.stringify(dispatch.batch, null, 2))

    const command = resolveAgentCommand(dispatch.agent, prompt, options.agentCommands)
    const child = spawn(command.executable, command.args, { cwd: project.path, env: spawnEnvironment() })
    if (command.stdin !== null) {
      child.stdin.write(command.stdin)
    }
    child.stdin.end()

    let tail = ''
    const collect = (chunk: Buffer) => {
      tail = (tail + chunk.toString('utf8')).slice(-OUTPUT_TAIL_LIMIT)
      updateRun({ ...run, status: 'running', outputTail: tail })
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    updateRun({ ...run, status: 'running' })

    child.on('error', (error) => {
      updateRun({ ...run, status: 'failed', outputTail: tail, finishedAt: new Date().toISOString(), error: errorMessage(error) })
    })
    child.on('close', (code) => {
      if (code === 0) {
        updateRun({ ...run, status: 'done', outputTail: tail, finishedAt: new Date().toISOString() })
        if (recaptureAfterRun) void recaptureProject(project)
      } else {
        updateRun({
          ...run,
          status: 'failed',
          outputTail: tail,
          finishedAt: new Date().toISOString(),
          error: `${command.executable} exited with code ${String(code)}`,
        })
      }
    })
    return run
  }

  function readProjectContext(project: Project) {
    return CONTEXT_FILE_NAMES.flatMap((name) => {
      const file = path.join(project.path, name)
      if (!existsSync(file)) return []
      return [{ name, content: readFileSync(file, 'utf8') }]
    })
  }

  function serveStatic(pathname: string, response: ServerResponse) {
    if (!existsSync(path.join(distDir, 'index.html'))) {
      response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('The canvas is not built yet. Run: npm run build')
      return
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1)
    const file = path.resolve(distDir, relative)
    const fallback = path.join(distDir, 'index.html')
    const target = file.startsWith(distDir + path.sep) && existsSync(file) ? file : fallback
    const extension = path.extname(target)
    if (extension === '.html' || target === fallback) {
      // The marker tells the canvas it is running inside the local app, so it
      // uses the HTTP board host instead of waiting for a window host.
      const html = readFileSync(fallback, 'utf8')
        .replace('<head>', '<head><script>window.__designModeHost = { version: 1 }</script>')
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      response.end(html)
      return
    }
    response.writeHead(200, { 'content-type': STATIC_CONTENT_TYPES[extension] ?? 'application/octet-stream' })
    response.end(readFileSync(target))
  }

  async function handleApi(request: IncomingMessage, response: ServerResponse, pathname: string) {
    const method = request.method ?? 'GET'

    if (pathname === '/api/health' && method === 'GET') {
      sendJson(response, 200, { ok: true, version: 1 })
      return
    }

    if (pathname === '/api/events' && method === 'GET') {
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      })
      response.write(': connected\n\n')
      const unsubscribe = events.subscribe((event) => {
        response.write(`data: ${JSON.stringify(event)}\n\n`)
      })
      const heartbeat = setInterval(() => response.write(': ping\n\n'), 15_000)
      request.on('close', () => {
        clearInterval(heartbeat)
        unsubscribe()
      })
      return
    }

    if (pathname === '/api/projects' && method === 'GET') {
      sendJson(response, 200, { projects: store.listProjects() })
      return
    }

    if (pathname === '/api/projects' && method === 'POST') {
      const registration = ProjectRegistrationSchema.parse(JSON.parse(await readBody(request)))
      if (!existsSync(registration.path)) {
        sendJson(response, 400, { error: `Project path does not exist: ${registration.path}` })
        return
      }
      sendJson(response, 201, { project: store.registerProject(registration) })
      return
    }

    if (pathname === '/api/agents' && method === 'GET') {
      sendJson(response, 200, AgentListSchema.parse({ agents: probeAgentAvailability(options.agentCommands) }))
      return
    }

    if (pathname === '/api/runs' && method === 'GET') {
      sendJson(response, 200, { runs: store.listRuns() })
      return
    }

    const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)\/(board|capture|context|dispatch|live|refresh)$/)
    if (!projectMatch) {
      sendJson(response, 404, { error: `Unknown API route: ${method} ${pathname}` })
      return
    }
    const project = store.getProject(projectMatch[1]!)
    if (!project) {
      sendJson(response, 404, { error: `Unknown project: ${projectMatch[1]!}` })
      return
    }
    const action = projectMatch[2]!

    if (action === 'board' && method === 'GET') {
      const board = store.readBoard(project.id)
      if (!board) {
        sendJson(response, 404, { error: `No board captured yet for ${project.name}` })
        return
      }
      sendJson(response, 200, BoardResponseSchema.parse({ board }))
      return
    }

    if (action === 'board' && method === 'PUT') {
      const board = BoardDocumentSchema.parse(JSON.parse(await readBody(request)))
      store.writeBoard(project.id, board)
      sendJson(response, 200, { saved: true })
      return
    }

    if (action === 'context' && method === 'GET') {
      sendJson(response, 200, { files: readProjectContext(project) })
      return
    }

    if (action === 'capture' && method === 'POST') {
      events.publish({ type: 'capture-started', projectId: project.id })
      try {
        const devServer = await devServerFor(project)
        const board = await captureProjectBoard(project, devServer.url, store.readBoard(project.id))
        store.writeBoard(project.id, board)
        events.publish({ type: 'board-updated', projectId: project.id })
        sendJson(response, 200, BoardResponseSchema.parse({ board }))
      } catch (error) {
        events.publish({ type: 'capture-failed', projectId: project.id, error: errorMessage(error) })
        throw error
      }
      return
    }

    if (action === 'refresh' && method === 'POST') {
      const { frameId } = RefreshRequestSchema.parse(JSON.parse(await readBody(request)))
      const route = project.routes.find((item) => item.id === frameId)
      if (!route) {
        sendJson(response, 404, { error: `Frame ${frameId} has no capture route; uploads refresh by re-import.` })
        return
      }
      const devServer = await devServerFor(project)
      const board = await captureProjectBoard(project, devServer.url, store.readBoard(project.id), [route])
      store.writeBoard(project.id, board)
      sendJson(response, 200, BoardResponseSchema.parse({ board }))
      return
    }

    if (action === 'live' && method === 'POST') {
      const { frameId } = LiveSessionRequestSchema.parse(JSON.parse(await readBody(request)))
      const route = project.routes.find((item) => item.id === frameId)
      if (!route) {
        sendJson(response, 404, { error: `Frame ${frameId} has no live route.` })
        return
      }
      const proxy = await liveProxyFor(project)
      const focusToken = randomUUID()
      sendJson(response, 200, LiveSessionResponseSchema.parse({
        liveUrl: `${proxy.origin}${route.path}#token=${focusToken}&frameId=${frameId}`,
        allowedOrigin: proxy.origin,
        focusToken,
      }))
      return
    }

    if (action === 'dispatch' && method === 'POST') {
      const dispatch = DispatchRequestSchema.parse(JSON.parse(await readBody(request)))
      const run = launchAgentRun(project, dispatch)
      sendJson(response, 202, { run })
      return
    }

    sendJson(response, 405, { error: `${method} is not supported on ${pathname}` })
  }

  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    if (pathname.startsWith('/api/')) {
      handleApi(request, response, pathname).catch((error) => {
        const status = error instanceof z.ZodError ? 400 : 500
        if (!response.headersSent) sendJson(response, status, { error: errorMessage(error) })
      })
      return
    }
    try {
      serveStatic(pathname, response)
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(errorMessage(error))
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.on('error', reject)
    server.listen(options.port ?? 4400, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  const port = address && typeof address !== 'string' ? address.port : options.port ?? 4400

  return {
    port,
    origin: `http://127.0.0.1:${port}`,
    events,
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      for (const proxy of liveProxies.values()) await proxy.then((item) => item.close()).catch(() => {})
      for (const handle of devServers.values()) await handle.then((item) => item.stop()).catch(() => {})
    },
  }
}
