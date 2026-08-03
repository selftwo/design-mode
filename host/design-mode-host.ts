import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import type { BoardDocument, DesignUnit } from '../src/features/review-board/model/board-document.schema.ts'
import { BoardDocumentSchema } from '../src/features/review-board/model/board-document.schema.ts'
import { getUnitGenerationEligibility } from '../src/features/review-board/model/unit-generation-eligibility.ts'
import {
  AgentListSchema,
  BoardConflictResponseSchema,
  BoardPutRequestSchema,
  BoardPutSuccessSchema,
  BoardReplyRequestSchema,
  BoardResolveRequestSchema,
  BoardResponseSchema,
  DispatchRequestSchema,
  GenerateOptionsRequestSchema,
  LearnRequestSchema,
  LiveSessionResponseSchema,
  ProjectRegistrationSchema,
  TeachQuestionRequestSchema,
  TeachQuestionResponseSchema,
  type AgentId,
  type AgentRun,
  type Project,
} from '../src/features/local-host/host-api.schema.ts'
import { appendThreadReply } from '../src/features/review-board/append-thread-reply.ts'
import { resolveBoardAnnotation } from '../src/features/review-board/resolve-board-annotation.ts'
import { resolveAgentCommand, probeAgentAvailability, type AgentCommandSpec } from './agent-adapters.ts'
import { buildAgentPrompt } from './build-agent-prompt.ts'
import { buildTeachPrompt } from './build-teach-prompt.ts'
import { buildLofiGeneratePrompt, type GenerationReference, type GenerationReviewTrace, type PriorDecision } from './build-lofi-generate-prompt.ts'
import { isReviewed } from '../src/features/review-board/model/review-telemetry.ts'
import { captureLofiOptions } from './capture-lofi-options.ts'
import { captureProjectFrames, ensureDevServer, type DevServerHandle } from './capture-project-board.ts'
import { createHostDataStore, defaultDataDir } from './host-data-store.ts'
import { createHostEventBus } from './host-event-bus.ts'
import { startLiveReviewProxy, type LiveReviewProxy } from './live-review-proxy.ts'
import { mergeCapturedFrames } from './merge-captured-frames.ts'
import {
  PLAYABLE_SCRATCH_CONTENT_SECURITY_POLICY,
  checkPlayableScratchHtml,
  injectPlayableBridge,
} from './playable-option-bridge.ts'
import { canvasEventsPath, ingestCanvasEvent, syncCanvasEventsFromFile } from './ingest-canvas-event.ts'
import { BoardMissingForSaveError, createProjectBoardWriteQueue } from './project-board-write-queue.ts'
import { spawnEnvironment } from './spawn-environment.ts'
import { CanvasEventSchema } from '../src/features/review-board/model/canvas-event.schema.ts'

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
  const boardWrites = createProjectBoardWriteQueue(store)
  const events = createHostEventBus()
  const distDir = options.distDir ?? fileURLToPath(new URL('../dist', import.meta.url))
  const recaptureAfterRun = options.recaptureAfterRun ?? true
  const devServers = new Map<string, Promise<DevServerHandle>>()
  const liveProxies = new Map<string, Promise<LiveReviewProxy>>()
  const activeRuns = new Map<string, AgentRun>()
  // Set once the server is listening; the scratch route is served by this
  // same host, so option capture never needs a project dev server.
  let hostOrigin = ''

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

  function writeBoardAndPublish(projectId: string, board: z.infer<typeof BoardDocumentSchema>) {
    store.writeBoard(projectId, board)
    events.publish({ type: 'board-updated', projectId })
  }

  async function recaptureProject(project: Project) {
    events.publish({ type: 'capture-started', projectId: project.id })
    try {
      const devServer = await devServerFor(project)
      // Merge inside the write queue against the board as it is at write time,
      // so a reviewer PUT that lands during the capture is never clobbered.
      const frames = await captureProjectFrames(project, devServer.url)
      await boardWrites.mutateAndSave(project.id, (latest) => mergeCapturedFrames(latest, frames, `${project.id}-board`))
      events.publish({ type: 'board-updated', projectId: project.id })
    } catch (error) {
      events.publish({ type: 'capture-failed', projectId: project.id, error: errorMessage(error) })
    }
  }

  // Renders the option set an agent just generated through the same capture
  // path as a real route, then merges the results onto the project's board as
  // playable option frames a reviewer can compare. The run id names the scratch
  // set and frame ids; the frames belong to the durable unit the reviewer made.
  async function captureLofiOptionsIntoBoard(project: Project, runId: string, unitId: string, expectedCount: number) {
    const optionDir = store.optionSetDir(project.id, runId)
    events.publish({ type: 'capture-started', projectId: project.id })
    try {
      const baseUrl = `${hostOrigin}/scratch/${project.id}/${runId}`
      const frames = await captureLofiOptions({ optionDir, baseUrl, runId, unitId, expectedCount })
      // Merge and persist inside the write queue so two runs for one unit keep
      // each other's frames and revision stays monotonic. If the unit vanished
      // while the agent ran, fail the capture rather than write an invalid board.
      await boardWrites.mutateAndSave(project.id, (latest) => {
        if (!latest || !latest.units.some((unit) => unit.id === unitId)) {
          throw new Error(`Design unit "${unitId}" is no longer on the board; capture discarded.`)
        }
        return mergeCapturedFrames(latest, frames, `${project.id}-board`)
      })
      events.publish({ type: 'board-updated', projectId: project.id })
    } catch (error) {
      events.publish({ type: 'capture-failed', projectId: project.id, error: errorMessage(error) })
    }
  }

  // Shared spawn lifecycle for every launcher: send the prompt over stdin,
  // collect a bounded output tail, and journal every status transition.
  // stdin errors are swallowed because an agent may exit without reading its
  // prompt (EPIPE must not crash the host), and a spawn error marks the run
  // failed once: the close event that follows it (code null) must not
  // overwrite the real error with "exited with code null".
  function runAgentProcess(input: {
    run: AgentRun
    agent: AgentId
    prompt: string
    cwd: string
    onSuccess?: () => void
  }) {
    const { run, agent, prompt, cwd, onSuccess } = input
    const command = resolveAgentCommand(agent, prompt, options.agentCommands)
    const child = spawn(command.executable, command.args, { cwd, env: spawnEnvironment() })
    child.stdin.on('error', () => {})
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

    let spawnFailed = false
    child.on('error', (error) => {
      spawnFailed = true
      updateRun({ ...run, status: 'failed', outputTail: tail, finishedAt: new Date().toISOString(), error: errorMessage(error) })
    })
    child.on('close', (code) => {
      if (spawnFailed) return
      if (code === 0) {
        updateRun({ ...run, status: 'done', outputTail: tail, finishedAt: new Date().toISOString() })
        onSuccess?.()
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

    runAgentProcess({
      run,
      agent: dispatch.agent,
      prompt,
      cwd: project.path,
      onSuccess: () => {
        // Agents may have appended canvas-events.jsonl during the run; land them
        // before (or instead of) a full recapture so questions appear promptly.
        void syncCanvasEventsFromFile({
          store,
          boardWrites,
          events,
          projectId: project.id,
          runId: run.id,
        }).finally(() => {
          if (recaptureAfterRun) void recaptureProject(project)
        })
      },
    })
    return run
  }

  // A learn run: the reviewer asked a question about one screen and the agent
  // answers by appending a teach-answer canvas event (no source edit, no
  // dispatch). Reuses the run journal, spawn, and SSE lifecycle. On a clean exit
  // the appended event is landed as an anchored teach annotation the same way a
  // dispatch run's questions are, so the answer reaches the canvas by request id.
  function launchTeachRun(project: Project, request: z.infer<typeof LearnRequestSchema>, board: BoardDocument) {
    const frame = board.frames.find((item) => item.id === request.frameId)!
    const run: AgentRun = {
      id: randomUUID(),
      projectId: project.id,
      agent: request.agent,
      status: 'queued',
      annotationIds: [],
      startedAt: new Date().toISOString(),
      outputTail: '',
    }
    updateRun(run)

    const assetDir = store.runAssetDir(run.id)
    const screenshotDirectory = path.join(assetDir, 'screens')
    mkdirSync(screenshotDirectory, { recursive: true })
    const screenshotPath = path.join(screenshotDirectory, `${frame.id}.png`)
    const base64 = frame.screenshotDataUrl.split(',')[1]
    if (base64) writeFileSync(screenshotPath, Buffer.from(base64, 'base64'))

    const contextFiles = readProjectContext(project)
    const prompt = buildTeachPrompt({
      project,
      request,
      runId: run.id,
      contextFiles,
      screenshotPath,
      canvasEventsPath: canvasEventsPath(store, run.id),
      createdAt: new Date().toISOString(),
    })
    writeFileSync(path.join(assetDir, 'prompt.md'), prompt)

    runAgentProcess({
      run,
      agent: request.agent,
      prompt,
      cwd: project.path,
      onSuccess: () => {
        void syncCanvasEventsFromFile({
          store,
          boardWrites,
          events,
          projectId: project.id,
          runId: run.id,
        })
      },
    })
    return run
  }

  // A generate-options run: the agent writes standalone lo-fi HTML into a
  // per-option-set scratch dir. Reuses the run journal, spawn, and SSE
  // lifecycle; the option set is identified by the run id. A later increment
  // serves the scratch dir and captures the HTML into option-tagged frames.
  // Reads a scratch HTML file named by a frame's live source. Returns '' when the
  // path is not a well-formed scratch locator or the file is gone, so a missing
  // artifact degrades to no HTML rather than failing the run.
  function readScratchHtml(sourcePath: string | undefined): string {
    if (!sourcePath) return ''
    const parts = sourcePath.split('/')
    // A scratch locator is '/scratch/<projectId>/<optionSetId>/<fileName>'.
    if (parts.length !== 5 || parts[1] !== 'scratch') return ''
    const dir = store.optionSetPath(parts[2]!, parts[3]!)
    const target = path.join(dir, parts[4]!)
    if (!target.startsWith(dir + path.sep) || !existsSync(target)) return ''
    return readFileSync(target, 'utf8')
  }

  // The locked winners of this unit's dependency units, so a dependent generation
  // stays consistent with what is already decided. Only dependencies that are
  // actually locked contribute; an open or missing dependency yields nothing (the
  // eligibility gate already blocks a run whose dependencies are not locked).
  function readPriorDecisions(board: BoardDocument, unit: DesignUnit): PriorDecision[] {
    const decisions: PriorDecision[] = []
    for (const depId of unit.dependsOnUnitIds) {
      const dep = board.units.find((item) => item.id === depId)
      if (!dep || dep.state !== 'locked' || !dep.lockedFrameId) continue
      const frame = board.frames.find((item) => item.id === dep.lockedFrameId)
      if (!frame) continue
      const verdict = board.verdicts.find((item) => item.unitId === dep.id && item.kind === 'promote')
      decisions.push({
        unitLabel: dep.label,
        summary: verdict?.summary ?? '',
        kitSnapshot: verdict?.kitSnapshot ?? frame.kit?.state ?? null,
        html: readScratchHtml(frame.liveSource?.path),
      })
    }
    return decisions
  }

  // Copy this unit's pinned reference images into the run asset dir so the agent
  // can open them, and return where each one landed for the prompt. The bytes
  // come from the frame's data URL; a frame with no decodable bytes is skipped.
  function writeUnitReferences(board: BoardDocument, unit: DesignUnit, assetDir: string): GenerationReference[] {
    const frames = board.frames.filter((frame) => frame.kind === 'reference-image' && frame.unitId === unit.id)
    if (frames.length === 0) return []
    const referenceDir = path.join(assetDir, 'references')
    mkdirSync(referenceDir, { recursive: true })
    const references: GenerationReference[] = []
    frames.forEach((frame, index) => {
      const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(frame.screenshotDataUrl)
      if (!match) return
      const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[match[1]!.toLowerCase()] ?? 'img'
      const safeLabel = frame.label.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'reference'
      const filePath = path.join(referenceDir, `${index + 1}-${safeLabel}.${extension}`)
      writeFileSync(filePath, Buffer.from(match[2]!, 'base64'))
      references.push({ label: frame.label, path: filePath })
    })
    return references
  }

  // The review traces for a unit's option frames, joined to their labels, so the
  // generation prompt can feed forward what was actually looked at.
  function readReviewTraces(board: BoardDocument, unit: DesignUnit): GenerationReviewTrace[] {
    const summaryByFrame = new Map(board.reviewSummaries.map((summary) => [summary.frameId, summary]))
    return board.frames
      .filter((frame) => frame.unitId === unit.id && (frame.kind === 'option-snapshot' || frame.kind === 'playable-option'))
      .map((frame) => {
        const summary = summaryByFrame.get(frame.id)
        return {
          label: frame.label,
          reviewed: summary ? isReviewed(summary) : false,
          visibleSeconds: summary?.visibleSeconds ?? 0,
          kitStatesTried: summary?.kitStatesTried ?? 0,
          playedLive: summary?.playedLive ?? false,
        }
      })
  }

  function launchLofiGenerateRun(project: Project, request: z.infer<typeof GenerateOptionsRequestSchema>, unit: DesignUnit, board: BoardDocument) {
    const run: AgentRun = {
      id: randomUUID(),
      projectId: project.id,
      agent: request.agent,
      status: 'queued',
      annotationIds: [],
      unitId: unit.id,
      startedAt: new Date().toISOString(),
      outputTail: '',
    }
    updateRun(run)

    const outputDir = store.optionSetDir(project.id, run.id)
    const assetDir = store.runAssetDir(run.id)
    const contextFiles = readProjectContext(project)
    const priorDecisions = readPriorDecisions(board, unit)
    const references = writeUnitReferences(board, unit, assetDir)
    const reviewTraces = readReviewTraces(board, unit)
    const prompt = buildLofiGeneratePrompt({ project, unit, count: request.count, outputDir, contextFiles, priorDecisions, references, reviewTraces })
    writeFileSync(path.join(assetDir, 'prompt.md'), prompt)

    runAgentProcess({
      run,
      agent: request.agent,
      prompt,
      cwd: outputDir,
      onSuccess: () => {
        if (recaptureAfterRun) void captureLofiOptionsIntoBoard(project, run.id, unit.id, request.count)
      },
    })
    return run
  }

  function runTeachQuestion(
    project: Project,
    agent: z.infer<typeof DispatchRequestSchema>['agent'],
    question: z.infer<typeof TeachQuestionRequestSchema>['question'],
  ): Promise<z.infer<typeof TeachQuestionResponseSchema>> {
    const run: AgentRun = {
      id: randomUUID(),
      projectId: project.id,
      agent,
      status: 'queued',
      annotationIds: [],
      startedAt: new Date().toISOString(),
      outputTail: '',
    }
    updateRun(run)

    const assetDir = store.runAssetDir(run.id)
    mkdirSync(assetDir, { recursive: true })
    const contextFiles = readProjectContext(project)
    const prompt = buildTeachPrompt({ project, question, contextFiles })
    writeFileSync(path.join(assetDir, 'prompt.md'), prompt)
    writeFileSync(path.join(assetDir, 'question.json'), JSON.stringify(question, null, 2))

    const command = resolveAgentCommand(agent, prompt, options.agentCommands)
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

    return new Promise((resolve, reject) => {
      child.on('error', (error) => {
        const failed = {
          ...run,
          status: 'failed' as const,
          outputTail: tail,
          finishedAt: new Date().toISOString(),
          error: errorMessage(error),
        }
        updateRun(failed)
        reject(error)
      })
      child.on('close', (code) => {
        try {
          if (code === 0) {
            const trimmed = tail.trim()
            if (!trimmed) {
              const failed = {
                ...run,
                status: 'failed' as const,
                outputTail: tail,
                finishedAt: new Date().toISOString(),
                error: 'Agent returned no output',
              }
              updateRun(failed)
              reject(new Error(failed.error))
              return
            }
            const done = {
              ...run,
              status: 'done' as const,
              outputTail: trimmed,
              finishedAt: new Date().toISOString(),
            }
            updateRun(done)
            resolve(TeachQuestionResponseSchema.parse({
              answer: { answer: trimmed, runId: run.id },
            }))
            return
          }
          const failed = {
            ...run,
            status: 'failed' as const,
            outputTail: tail,
            finishedAt: new Date().toISOString(),
            error: `${command.executable} exited with code ${String(code)}`,
          }
          updateRun(failed)
          reject(new Error(failed.error))
        } catch (error) {
          const failed = {
            ...run,
            status: 'failed' as const,
            outputTail: tail,
            finishedAt: new Date().toISOString(),
            error: errorMessage(error),
          }
          updateRun(failed)
          reject(error instanceof Error ? error : new Error(errorMessage(error)))
        }
      })
    })
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
    const mWebFallback = path.join(distDir, 'm-web.html')
    const isMWebRoute = pathname === '/m-web' || pathname === '/m-web.html' || pathname.startsWith('/m-web/')
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1)
    const file = path.resolve(distDir, relative)
    const fallback = isMWebRoute && existsSync(mWebFallback) ? mWebFallback : path.join(distDir, 'index.html')
    const target = file.startsWith(distDir + path.sep) && existsSync(file) ? file : fallback
    const extension = path.extname(target)
    if (extension === '.html' || target === fallback) {
      const htmlFile = target === fallback && isMWebRoute ? mWebFallback : fallback
      const html = readFileSync(htmlFile, 'utf8')
        .replace('<head>', '<head><script>window.__designModeHost = { version: 1 }</script>')
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      response.end(html)
      return
    }
    response.writeHead(200, { 'content-type': STATIC_CONTENT_TYPES[extension] ?? 'application/octet-stream' })
    response.end(readFileSync(target))
  }

  // Serves an option set's generated HTML so Playwright (and the reviewer's
  // browser, for a live look) can load it the same way it loads a real route.
  function serveScratchFile(pathname: string, response: ServerResponse) {
    const [projectId, optionSetId, fileName] = pathname.replace(/^\/scratch\//, '').split('/')
    if (!projectId || !optionSetId || !fileName) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }
    // Resolve without creating directories: a GET for a set that does not
    // exist must 404, not mkdir on every probe.
    const dir = store.optionSetPath(projectId, optionSetId)
    const target = path.join(dir, fileName)
    if (!target.startsWith(dir + path.sep) || !existsSync(target)) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }
    const extension = path.extname(target)

    // Playable option HTML is served with the one injected bridge script and a
    // strict content policy that allows only that script and inline styles.
    // Anything the agent wrote that would defeat the policy (a hook that is
    // missing, an authored script) is refused rather than served.
    if (extension === '.html') {
      const raw = readFileSync(target, 'utf8')
      const check = checkPlayableScratchHtml(raw)
      if (!check.ok) {
        response.writeHead(422, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        response.end(`Not a serveable playable option: ${check.reason}`)
        return
      }
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': PLAYABLE_SCRATCH_CONTENT_SECURITY_POLICY,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      })
      response.end(injectPlayableBridge(raw))
      return
    }

    // Kit JSON and any other artifact is served as raw bytes, never injected.
    response.writeHead(200, {
      'content-type': STATIC_CONTENT_TYPES[extension] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    })
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

    // Agent→canvas back-channel: append a checked event to the run's jsonl,
    // apply it through the board write queue, and fan out a board-patched SSE.
    const canvasEventMatch = pathname.match(/^\/api\/runs\/([^/]+)\/canvas-events(?:\/(sync))?$/)
    if (canvasEventMatch) {
      const runId = canvasEventMatch[1]!
      // Active runs are in memory; otherwise read just this run's journal
      // entry instead of parsing every runs/*/run.json per event.
      const run = activeRuns.get(runId) ?? store.readRun(runId)
      if (!run) {
        sendJson(response, 404, { error: `Unknown run: ${runId}` })
        return
      }
      if (canvasEventMatch[2] === 'sync' && method === 'POST') {
        const result = await syncCanvasEventsFromFile({
          store,
          boardWrites,
          events,
          projectId: run.projectId,
          runId,
        })
        sendJson(response, 200, {
          applied: result.applied.length,
          board: result.board,
        })
        return
      }
      if (method === 'POST') {
        const event = CanvasEventSchema.parse({
          ...JSON.parse(await readBody(request)),
          runId,
        })
        const result = await ingestCanvasEvent({
          store,
          boardWrites,
          events,
          projectId: run.projectId,
          runId,
          event,
        })
        if (!result.ok) {
          const status = result.reason === 'no-board' ? 404 : 400
          sendJson(response, status, { error: `Canvas event rejected: ${result.reason}` })
          return
        }
        sendJson(response, result.applied ? 201 : 200, {
          annotation: result.annotation,
          board: result.board,
          applied: result.applied,
          appended: result.appended,
        })
        return
      }
      sendJson(response, 405, { error: `${method} is not supported on ${pathname}` })
      return
    }

    const boardMutationMatch = pathname.match(/^\/api\/projects\/([^/]+)\/board\/(reply|resolve)$/)
    if (boardMutationMatch) {
      const project = store.getProject(boardMutationMatch[1]!)
      if (!project) {
        sendJson(response, 404, { error: `Unknown project: ${boardMutationMatch[1]!}` })
        return
      }
      const mutation = boardMutationMatch[2]!
      const board = store.readBoard(project.id)
      if (!board) {
        sendJson(response, 404, { error: `No board captured yet for ${project.name}` })
        return
      }
      if (mutation === 'reply' && method === 'POST') {
        const replyRequest = BoardReplyRequestSchema.parse(JSON.parse(await readBody(request)))
        const next = appendThreadReply(board, replyRequest.annotationId, replyRequest.body, replyRequest.author)
        writeBoardAndPublish(project.id, next)
        sendJson(response, 200, BoardResponseSchema.parse({ board: next }))
        return
      }
      if (mutation === 'resolve' && method === 'POST') {
        const resolveRequest = BoardResolveRequestSchema.parse(JSON.parse(await readBody(request)))
        const next = resolveBoardAnnotation(board, resolveRequest.annotationId)
        writeBoardAndPublish(project.id, next)
        sendJson(response, 200, BoardResponseSchema.parse({ board: next }))
        return
      }
      sendJson(response, 404, { error: `Unknown API route: ${method} ${pathname}` })
      return
    }

    const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)\/(board|capture|context|dispatch|generate-options|learn|live|refresh|teach)$/)
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
      const put = BoardPutRequestSchema.parse(JSON.parse(await readBody(request)))
      try {
        const result = await boardWrites.compareAndSave(project.id, {
          baseRevision: put.baseRevision,
          board: put.board,
        })
        if (!result.ok) {
          sendJson(response, 409, BoardConflictResponseSchema.parse({
            error: 'Board revision conflict.',
            documentRevision: result.conflict.documentRevision,
            board: result.conflict,
          }))
          return
        }
        events.publish({ type: 'board-updated', projectId: project.id })
        sendJson(response, 200, BoardPutSuccessSchema.parse({ board: result.board }))
      } catch (error) {
        if (error instanceof BoardMissingForSaveError) {
          sendJson(response, 404, { error: error.message })
          return
        }
        throw error
      }
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
        const frames = await captureProjectFrames(project, devServer.url)
        const board = await boardWrites.mutateAndSave(project.id, (latest) => mergeCapturedFrames(latest, frames, `${project.id}-board`))
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
      const frames = await captureProjectFrames(project, devServer.url, [route])
      const board = await boardWrites.mutateAndSave(project.id, (latest) => mergeCapturedFrames(latest, frames, `${project.id}-board`))
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

    if (action === 'learn' && method === 'POST') {
      const learnRequest = LearnRequestSchema.parse(JSON.parse(await readBody(request)))
      // The frame must be on the saved board: the agent answers about a real
      // captured screen and its teach event is rejected later if the frame is
      // gone, so fail fast here with a 404 rather than launch a doomed run.
      const board = store.readBoard(project.id)
      if (!board?.frames.some((frame) => frame.id === learnRequest.frameId)) {
        sendJson(response, 404, { error: `Unknown frame: ${learnRequest.frameId}` })
        return
      }
      const run = launchTeachRun(project, learnRequest, board)
      sendJson(response, 202, { run })
      return
    }

    if (action === 'generate-options' && method === 'POST') {
      const generateRequest = GenerateOptionsRequestSchema.parse(JSON.parse(await readBody(request)))
      // The host is the final authority: it checks its own saved board, so a
      // unit the reviewer created must have reached disk first. 404 and 409 are
      // sent directly, never thrown, so the outer handler cannot turn them into
      // a 500.
      const board = store.readBoard(project.id)
      const eligibility = board
        ? getUnitGenerationEligibility(board, generateRequest.unitId)
        : ({ kind: 'missing', unitId: generateRequest.unitId } as const)
      if (eligibility.kind === 'missing') {
        sendJson(response, 404, { error: `Unknown design unit: ${generateRequest.unitId}` })
        return
      }
      if (eligibility.kind === 'locked') {
        sendJson(response, 409, { error: `Design unit "${eligibility.unit.label}" is locked.` })
        return
      }
      if (eligibility.kind === 'blocked') {
        const blockers = eligibility.blockingUnitIds
          .map((id) => board!.units.find((unit) => unit.id === id)?.label ?? id)
          .join(', ')
        sendJson(response, 409, { error: `Design unit "${eligibility.unit.label}" is blocked by: ${blockers}.` })
        return
      }
      const run = launchLofiGenerateRun(project, generateRequest, eligibility.unit, board!)
      sendJson(response, 202, { run })
      return
    }

    if (action === 'teach' && method === 'POST') {
      const body = TeachQuestionRequestSchema.parse(JSON.parse(await readBody(request)))
      const agents = probeAgentAvailability(options.agentCommands)
      const agent = body.agent ?? agents.find((item) => item.available)?.id ?? 'claude'
      try {
        const result = await runTeachQuestion(project, agent, body.question)
        sendJson(response, 200, result)
      } catch (error) {
        sendJson(response, 500, { error: errorMessage(error) })
      }
      return
    }

    sendJson(response, 405, { error: `${method} is not supported on ${pathname}` })
  }

  // Browsers send text/plain POSTs without a CORS preflight, so a drive-by web
  // page could hit state-changing routes (dispatch spawns agent CLIs). Requests
  // with no Origin header (CLI, curl, tests) pass; a browser-supplied Origin
  // must be this host or another local http origin (any port). Everything else
  // is refused before any handler work happens.
  function requestOriginAllowed(request: IncomingMessage): boolean {
    const origin = request.headers.origin
    if (typeof origin !== 'string' || origin.length === 0) return true
    if (origin === hostOrigin) return true
    let parsed: URL
    try {
      parsed = new URL(origin)
    } catch {
      return false
    }
    if (parsed.protocol !== 'http:') return false
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]'
  }

  const server = createServer((request, response) => {
    const method = request.method ?? 'GET'
    if ((method === 'POST' || method === 'PUT' || method === 'DELETE') && !requestOriginAllowed(request)) {
      sendJson(response, 403, { error: 'Cross-origin state-changing requests are not allowed.' })
      return
    }
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    if (pathname.startsWith('/api/')) {
      handleApi(request, response, pathname).catch((error) => {
        const status = error instanceof z.ZodError ? 400 : 500
        if (!response.headersSent) sendJson(response, status, { error: errorMessage(error) })
      })
      return
    }
    if (pathname.startsWith('/scratch/')) {
      try {
        serveScratchFile(pathname, response)
      } catch (error) {
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        response.end(errorMessage(error))
      }
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
  hostOrigin = `http://127.0.0.1:${port}`

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
