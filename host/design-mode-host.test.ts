import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BoardDocument } from '../src/features/review-board/model/board-document.schema.ts'
import type { AgentRun, HostEvent } from '../src/features/local-host/host-api.schema.ts'
import { startDesignModeHost } from './design-mode-host.ts'

const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function testBoard(): BoardDocument {
  return {
    schemaVersion: 1,
    boardId: 'host-test-board',
    camera: { worldX: 0, worldY: 0, zoom: 1 },
    frames: [
      {
        id: 'home',
        label: 'Home',
        route: '/',
        viewport: { width: 1440, height: 900 },
        x: 0,
        y: 0,
        width: 420,
        height: 262.5,
        aspectRatio: 1.6,
        screenshotPath: 'screens/home.png',
        screenshotDataUrl: dataUrl,
        refreshedScreenshotDataUrl: dataUrl,
        captureHash: 'home-hash',
        revision: 1,
        elements: [],
      },
    ],
    annotations: [],
  }
}

describe('design-mode host API', () => {
  let dataDir: string
  let projectDir: string
  let host: Awaited<ReturnType<typeof startDesignModeHost>>

  beforeEach(async () => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'design-mode-host-'))
    projectDir = mkdtempSync(path.join(os.tmpdir(), 'design-mode-project-'))
    writeFileSync(path.join(projectDir, 'DESIGN.md'), 'Primary color is plum.')
    writeFileSync(path.join(projectDir, 'README.md'), 'A demo project.')
    host = await startDesignModeHost({
      port: 0,
      dataDir,
      distDir: path.join(dataDir, 'no-dist'),
      recaptureAfterRun: false,
      agentCommands: {
        claude: {
          executable: 'node',
          args: ['-e', 'let input="";process.stdin.on("data",(c)=>input+=c);process.stdin.on("end",()=>{require("node:fs").writeFileSync("agent-received.md",input);console.log("applied review");})'],
          promptVia: 'stdin',
        },
        codex: { executable: 'node', args: ['-e', 'process.exit(3)'], promptVia: 'stdin' },
        cursor: {
          executable: 'node',
          args: ['-e', 'console.log("cursor teach answer")'], 
          promptVia: 'stdin',
        },
      },
    })
  })

  afterEach(async () => {
    await host.close()
    rmSync(dataDir, { recursive: true, force: true })
    rmSync(projectDir, { recursive: true, force: true })
  })

  async function api(method: string, route: string, body?: unknown) {
    const response = await fetch(`${host.origin}${route}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, body: await response.json() as Record<string, unknown> }
  }

  async function registerProject() {
    const { status, body } = await api('POST', '/api/projects', {
      name: 'Demo project',
      path: projectDir,
      devCommand: 'npm run dev',
      devPort: 5183,
      routes: [{ id: 'home', label: 'Home', path: '/' }],
    })
    expect(status).toBe(201)
    return (body.project as { id: string }).id
  }

  it('registers projects and serves their design context files', async () => {
    const projectId = await registerProject()
    const projects = await api('GET', '/api/projects')
    expect((projects.body.projects as unknown[]).length).toBe(1)

    const context = await api('GET', `/api/projects/${projectId}/context`)
    const files = context.body.files as Array<{ name: string; content: string }>
    expect(files.map((file) => file.name)).toEqual(['DESIGN.md', 'README.md'])
    expect(files[0]!.content).toContain('plum')
  })

  it('rejects a project whose path does not exist', async () => {
    const { status, body } = await api('POST', '/api/projects', {
      name: 'Ghost',
      path: '/definitely/not/here',
      devCommand: 'npm run dev',
      devPort: 5000,
      routes: [{ id: 'home', label: 'Home', path: '/' }],
    })
    expect(status).toBe(400)
    expect(String(body.error)).toContain('does not exist')
  })

  it('stores only validated boards and returns them unchanged', async () => {
    const projectId = await registerProject()
    expect((await api('GET', `/api/projects/${projectId}/board`)).status).toBe(404)

    const put = await api('PUT', `/api/projects/${projectId}/board`, testBoard())
    expect(put.status).toBe(200)
    const get = await api('GET', `/api/projects/${projectId}/board`)
    expect(get.status).toBe(200)
    expect((get.body.board as BoardDocument).boardId).toBe('host-test-board')

    const invalid = await api('PUT', `/api/projects/${projectId}/board`, { schemaVersion: 99 })
    expect(invalid.status).toBe(400)
  })

  it('dispatches a batch to an agent, journals the run, and emits events', async () => {
    const projectId = await registerProject()
    await api('PUT', `/api/projects/${projectId}/board`, testBoard())

    const seen: HostEvent[] = []
    const eventSource = await fetch(`${host.origin}/api/events`)
    const reader = eventSource.body!.getReader()
    const readEvents = (async () => {
      const decoder = new TextDecoder()
      let buffered = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffered += decoder.decode(value, { stream: true })
        for (const block of buffered.split('\n\n').slice(0, -1)) {
          const data = block.split('\n').find((line) => line.startsWith('data: '))
          if (data) seen.push(JSON.parse(data.slice(6)) as HostEvent)
        }
        buffered = buffered.split('\n\n').at(-1) ?? ''
      }
    })()

    const batch = {
      schemaVersion: 1,
      boardId: 'host-test-board',
      exportedAt: new Date().toISOString(),
      annotations: [
        {
          schemaVersion: 1,
          id: 'note-1',
          status: 'draft',
          instruction: 'Raise the contrast of the header',
          intent: 'bolder',
          frameId: 'home',
          route: '/',
          viewport: { width: 1440, height: 900 },
          fullScreenshot: 'screens/home.png',
          crop: null,
          elements: [],
          marks: [],
          anchor: [0.5, 0.1],
          madeAgainst: { sha: null, timestamp: new Date().toISOString(), captureHash: 'home-hash', revision: 1 },
        },
      ],
    }

    const dispatched = await api('POST', `/api/projects/${projectId}/dispatch`, { agent: 'claude', batch })
    expect(dispatched.status).toBe(202)
    const runId = (dispatched.body.run as AgentRun).id

    let run: AgentRun | undefined
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const runs = (await api('GET', '/api/runs')).body.runs as AgentRun[]
      run = runs.find((item) => item.id === runId)
      if (run && (run.status === 'done' || run.status === 'failed')) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    expect(run?.status).toBe('done')
    expect(run?.outputTail).toContain('applied review')
    expect(run?.annotationIds).toEqual(['note-1'])

    // The agent received the full prompt with context and the intent vocabulary.
    const received = readFileSync(path.join(projectDir, 'agent-received.md'), 'utf8')
    expect(received).toContain('Design intent: bolder')
    expect(received).toContain('Primary color is plum.')
    // Run assets are journaled for inspection and replay.
    const runDir = path.join(dataDir, 'runs', runId)
    expect(existsSync(path.join(runDir, 'prompt.md'))).toBe(true)
    expect(existsSync(path.join(runDir, 'batch.json'))).toBe(true)
    expect(existsSync(path.join(runDir, 'screens', 'home.png'))).toBe(true)

    await reader.cancel()
    await readEvents.catch(() => {})
    expect(seen.some((event) => event.type === 'run-updated' && event.run.status === 'done')).toBe(true)
  })

  it('reports a failed agent exit as a failed run', async () => {
    const projectId = await registerProject()
    await api('PUT', `/api/projects/${projectId}/board`, testBoard())
    const batch = {
      schemaVersion: 1,
      boardId: 'host-test-board',
      exportedAt: new Date().toISOString(),
      annotations: [],
    }
    const dispatched = await api('POST', `/api/projects/${projectId}/dispatch`, { agent: 'codex', batch })
    expect(dispatched.status).toBe(202)
    const runId = (dispatched.body.run as AgentRun).id
    let run: AgentRun | undefined
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const runs = (await api('GET', '/api/runs')).body.runs as AgentRun[]
      run = runs.find((item) => item.id === runId)
      if (run && run.status !== 'running' && run.status !== 'queued') break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    expect(run?.status).toBe('failed')
    expect(run?.error).toContain('code 3')
  })

  it('answers a teach question through the configured agent', async () => {
    const projectId = await registerProject()
    const teach = await api('POST', `/api/projects/${projectId}/teach`, {
      question: {
        schemaVersion: 1,
        frameId: 'home',
        route: '/',
        viewport: { width: 1440, height: 900 },
        element: {
          id: 'plan-keep',
          label: 'plan-keep',
          role: 'button',
          bounds: [[0.5, 0.5], [0.8, 0.7]],
        },
        anatomy: 'plan-keep = button\n  > plan-keep (solid fill)',
        vocabularyTerm: 'signal',
        whyLine: 'A filled control reads as the primary action.',
        question: 'Why does this card read heavier than the others?',
      },
    })
    expect(teach.status).toBe(200)
    expect((teach.body.answer as { answer: string }).answer).toContain('applied review')
    const received = readFileSync(path.join(projectDir, 'agent-received.md'), 'utf8')
    expect(received).toContain('Explain only')
    expect(received).toContain('Why does this card read heavier')
  })

  it('answers health checks so the canvas can detect the local app', async () => {
    const health = await api('GET', '/api/health')
    expect(health.status).toBe(200)
    expect(health.body.ok).toBe(true)
  })

  function reviewAnnotation(id: string): BoardDocument['annotations'][number] {
    return {
      kind: 'review',
      id,
      status: 'draft',
      instruction: 'Raise the contrast of the header',
      intent: 'bolder',
      frameId: 'home',
      anchor: [0.5, 0.1],
      mark: null,
      createdAt: new Date().toISOString(),
      madeAgainstCaptureHash: 'home-hash',
      madeAgainstRevision: 1,
    }
  }

  it('appends a reply without clobbering annotations added after the client loaded', async () => {
    const projectId = await registerProject()
    const initial = { ...testBoard(), annotations: [reviewAnnotation('note-1'), reviewAnnotation('note-2')] }
    await api('PUT', `/api/projects/${projectId}/board`, initial)

    const desktopBoard = {
      ...initial,
      annotations: [...initial.annotations, reviewAnnotation('note-3')],
    }
    await api('PUT', `/api/projects/${projectId}/board`, desktopBoard)

    const replied = await api('POST', `/api/projects/${projectId}/board/reply`, {
      annotationId: 'note-1',
      body: 'Looks good from the phone.',
    })
    expect(replied.status).toBe(200)
    const board = replied.body.board as BoardDocument
    expect(board.annotations).toHaveLength(3)
    expect(board.annotations.find((item) => item.id === 'note-3')).toBeTruthy()
    const noteOne = board.annotations.find((item) => item.id === 'note-1')
    expect(noteOne && 'replies' in noteOne ? noteOne.replies?.[0]?.body : null).toBe('Looks good from the phone.')
  })

  it('publishes board-updated when the board is written or mutated', async () => {
    const projectId = await registerProject()
    const seen: HostEvent[] = []
    const eventSource = await fetch(`${host.origin}/api/events`)
    const reader = eventSource.body!.getReader()
    const decoder = new TextDecoder()
    let buffered = ''
    const pump = (async () => {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffered += decoder.decode(value, { stream: true })
        for (const block of buffered.split('\n\n').slice(0, -1)) {
          const data = block.split('\n').find((line) => line.startsWith('data: '))
          if (data) seen.push(JSON.parse(data.slice(6)) as HostEvent)
        }
        buffered = buffered.split('\n\n').at(-1) ?? ''
      }
    })()

    const board = { ...testBoard(), annotations: [reviewAnnotation('note-1')] }
    const put = await api('PUT', `/api/projects/${projectId}/board`, board)
    expect(put.status).toBe(200)

    const resolve = await api('POST', `/api/projects/${projectId}/board/resolve`, { annotationId: 'note-1' })
    expect(resolve.status).toBe(200)

    await new Promise((resolveWait) => setTimeout(resolveWait, 50))
    await reader.cancel()
    await pump.catch(() => {})
    expect(seen.filter((event) => event.type === 'board-updated' && event.projectId === projectId).length).toBeGreaterThanOrEqual(2)
  })

  it('returns a clean error when a teach agent exits with empty stdout', async () => {
    const silentDataDir = mkdtempSync(path.join(os.tmpdir(), 'design-mode-host-silent-'))
    const silentProjectDir = mkdtempSync(path.join(os.tmpdir(), 'design-mode-project-silent-'))
    writeFileSync(path.join(silentProjectDir, 'README.md'), 'demo')
    const hostWithSilentAgent = await startDesignModeHost({
      port: 0,
      dataDir: silentDataDir,
      distDir: path.join(silentDataDir, 'no-dist'),
      recaptureAfterRun: false,
      agentCommands: {
        claude: { executable: 'node', args: ['-e', 'process.exit(0)'], promptVia: 'stdin' },
      },
    })
    try {
      const registered = await fetch(`${hostWithSilentAgent.origin}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Silent teach',
          path: silentProjectDir,
          devCommand: 'npm run dev',
          devPort: 5183,
          routes: [{ id: 'home', label: 'Home', path: '/' }],
        }),
      })
      const projectId = ((await registered.json()) as { project: { id: string } }).project.id
      const teach = await fetch(`${hostWithSilentAgent.origin}/api/projects/${projectId}/teach`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: {
            schemaVersion: 1,
            frameId: 'home',
            route: '/',
            viewport: { width: 1440, height: 900 },
            element: { id: 'btn', label: 'btn', role: 'button', bounds: [[0.5, 0.5], [0.8, 0.7]] },
            anatomy: 'btn',
            vocabularyTerm: 'signal',
            whyLine: 'why',
            question: 'Why?',
          },
        }),
      })
      expect(teach.status).toBe(500)
      expect((await teach.json() as { error: string }).error).toContain('no output')
    } finally {
      await hostWithSilentAgent.close()
      rmSync(silentDataDir, { recursive: true, force: true })
      rmSync(silentProjectDir, { recursive: true, force: true })
    }
  })

  it('honors the requested teach agent', async () => {
    const projectId = await registerProject()
    const teach = await api('POST', `/api/projects/${projectId}/teach`, {
      agent: 'cursor',
      question: {
        schemaVersion: 1,
        frameId: 'home',
        route: '/',
        viewport: { width: 1440, height: 900 },
        element: { id: 'btn', label: 'btn', role: 'button', bounds: [[0.5, 0.5], [0.8, 0.7]] },
        anatomy: 'btn',
        vocabularyTerm: 'signal',
        whyLine: 'why',
        question: 'Why heavier?',
      },
    })
    expect(teach.status).toBe(200)
    expect((teach.body.answer as { answer: string }).answer).toContain('cursor teach answer')
  })
})
