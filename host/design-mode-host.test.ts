import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BoardDocumentSchema, type BoardDocument, type DesignUnit } from '../src/features/review-board/model/board-document.schema.ts'
import type { AgentRun, HostEvent } from '../src/features/local-host/host-api.schema.ts'
import { startDesignModeHost } from './design-mode-host.ts'

const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

// A fake agent that writes a valid option-N.html + option-N.kit.json pair for
// each of two options: HTML carries the playable bridge hook and no authored
// script, and each kit is a one-toggle manifest.
const GENERATE_VALID_PAIRS_SCRIPT = [
  'const fs=require("node:fs");',
  'const hook=\'<meta name="design-mode-playable-bridge" content="1">\';',
  'const kit=JSON.stringify({manifestVersion:1,controls:[{kind:"toggle",id:"dense",label:"Dense",default:false}]});',
  'fs.writeFileSync("option-1.html","<html><head>"+hook+"</head><body><button>Sign in</button></body></html>");',
  'fs.writeFileSync("option-1.kit.json",kit);',
  'fs.writeFileSync("option-2.html","<html><head>"+hook+"</head><body><a href=\'/\'>Continue</a></body></html>");',
  'fs.writeFileSync("option-2.kit.json",kit);',
  'console.log("generated options");',
].join('')

// A fake agent whose second option ships a broken kit file, so capture must
// reject the whole set.
const GENERATE_BAD_SECOND_KIT_SCRIPT = [
  'const fs=require("node:fs");',
  'const hook=\'<meta name="design-mode-playable-bridge" content="1">\';',
  'const kit=JSON.stringify({manifestVersion:1,controls:[{kind:"toggle",id:"dense",label:"Dense",default:false}]});',
  'fs.writeFileSync("option-1.html","<html><head>"+hook+"</head><body><button>One</button></body></html>");',
  'fs.writeFileSync("option-1.kit.json",kit);',
  'fs.writeFileSync("option-2.html","<html><head>"+hook+"</head><body><button>Two</button></body></html>");',
  'fs.writeFileSync("option-2.kit.json","{ broken");',
  'console.log("generated options");',
].join('')

// A fake teach agent: it reads the prompt on stdin, pulls the canvas-events path
// and the ready-made teach-answer template out of it, fills the two placeholders,
// and appends the event, the way a real agent answers a learn request.
const TEACH_ANSWER_SCRIPT = [
  'let input="";',
  'process.stdin.on("data",(c)=>input+=c);',
  'process.stdin.on("end",()=>{',
  '  const fs=require("node:fs");',
  '  const dest=input.match(/Append one line to `([^`]+)`/)[1];',
  '  const line=input.split("\\n").find((l)=>l.startsWith("{"));',
  '  const filled=line.replace(\'"ID"\',\'"teach-answer-1"\').replace("INSTRUCTION","That is the primary submit button.");',
  '  fs.appendFileSync(dest, filled+"\\n");',
  '  console.log("pinned the answer");',
  '});',
].join('')

function testBoard(): BoardDocument {
  return {
    schemaVersion: 2,
    boardId: 'host-test-board',
    documentRevision: 1,
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
        kind: 'captured-route',
        lifeState: 'active',
      },
    ],
    annotations: [],
    units: [],
    zones: [],
    verdicts: [],
    reviewSummaries: [],
  }
}

function openUnit(id = 'design-unit'): DesignUnit {
  return { id, label: `Unit ${id}`, brief: 'Pick a direction', rules: ['Keep it lo-fi'], dependsOnUnitIds: [], state: 'open' }
}

// A board carrying one open unit and no frames yet, so a generation capture can
// merge into it and land exactly the option frames.
function boardWithOpenUnit(id = 'design-unit'): BoardDocument {
  return { ...testBoard(), frames: [], units: [openUnit(id)] }
}

// A valid locked unit: a locked option-snapshot winner plus its promote verdict.
function lockedUnitBoard(): BoardDocument {
  const base = testBoard()
  const winner = { ...base.frames[0]!, id: 'winner', label: 'Winner', kind: 'option-snapshot' as const, lifeState: 'locked' as const, unitId: 'locked-unit' }
  return {
    ...base,
    frames: [base.frames[0]!, winner],
    units: [{ id: 'locked-unit', label: 'Locked unit', brief: 'done', rules: [], dependsOnUnitIds: [], state: 'locked', lockedFrameId: 'winner' }],
    verdicts: [{ id: 'v1', unitId: 'locked-unit', frameId: 'winner', kind: 'promote', summary: 'chosen', createdAt: new Date().toISOString(), kitSnapshot: null, referenceFrameIds: [] }],
  }
}

// A dependent open unit whose one dependency is locked: the dependency winner is
// a playable option pointing at a scratch file, so the prompt can carry its
// label, ledger summary, locked kit state, and winning HTML.
function feedforwardBoard(projectId: string, optionSetId: string): BoardDocument {
  const base = testBoard()
  const winner = {
    ...base.frames[0]!,
    id: 'dep-winner',
    label: 'Nav winner',
    kind: 'playable-option' as const,
    lifeState: 'locked' as const,
    unitId: 'nav',
    liveSource: {
      kind: 'scratch-html' as const,
      path: `/scratch/${projectId}/${optionSetId}/option-1.html`,
      protocolVersion: 1 as const,
      artifactHash: 'a'.repeat(64),
    },
    kit: {
      manifest: { manifestVersion: 1 as const, controls: [{ kind: 'toggle' as const, id: 'dense', label: 'Dense', default: false }] },
      state: { dense: true },
    },
  }
  return {
    ...base,
    frames: [base.frames[0]!, winner],
    units: [
      { id: 'nav', label: 'Navigation shell', brief: 'shell', rules: [], dependsOnUnitIds: [], state: 'locked', lockedFrameId: 'dep-winner' },
      { id: 'design-unit', label: 'Body', brief: 'body content', rules: [], dependsOnUnitIds: ['nav'], state: 'open' },
    ],
    verdicts: [{ id: 'v-nav', unitId: 'nav', frameId: 'dep-winner', kind: 'promote', summary: 'Locked the left rail.', createdAt: new Date().toISOString(), kitSnapshot: { dense: true }, referenceFrameIds: [] }],
  }
}

// An open unit blocked by an open dependency.
function blockedUnitBoard(): BoardDocument {
  return {
    ...testBoard(),
    frames: [],
    units: [
      { id: 'dep', label: 'Dependency', brief: 'first', rules: [], dependsOnUnitIds: [], state: 'open' },
      { id: 'design-unit', label: 'Blocked unit', brief: 'second', rules: [], dependsOnUnitIds: ['dep'], state: 'open' },
    ],
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

  async function putBoard(projectId: string, board: BoardDocument, baseRevision: number) {
    return api('PUT', `/api/projects/${projectId}/board`, { baseRevision, board })
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

  it('stores only validated boards and assigns host-owned documentRevision', async () => {
    const projectId = await registerProject()
    expect((await api('GET', `/api/projects/${projectId}/board`)).status).toBe(404)

    const put = await putBoard(projectId, testBoard(), 0)
    expect(put.status).toBe(200)
    expect((put.body.board as BoardDocument).documentRevision).toBe(1)
    expect((put.body.board as BoardDocument).boardId).toBe('host-test-board')

    const get = await api('GET', `/api/projects/${projectId}/board`)
    expect(get.status).toBe(200)
    expect((get.body.board as BoardDocument).boardId).toBe('host-test-board')
    expect((get.body.board as BoardDocument).documentRevision).toBe(1)

    const invalid = await api('PUT', `/api/projects/${projectId}/board`, { schemaVersion: 99 })
    expect(invalid.status).toBe(400)
  })

  it('compare-and-save PUT bumps revision and rejects stale baseRevision with 409', async () => {
    const projectId = await registerProject()
    const board = testBoard()

    const create = await putBoard(projectId, board, 0)
    expect(create.status).toBe(200)
    expect((create.body.board as BoardDocument).documentRevision).toBe(1)

    const update = await putBoard(projectId, { ...board, boardId: 'host-test-board-v2' }, 1)
    expect(update.status).toBe(200)
    expect((update.body.board as BoardDocument).documentRevision).toBe(2)
    expect((update.body.board as BoardDocument).boardId).toBe('host-test-board-v2')

    const stale = await putBoard(projectId, board, 1)
    expect(stale.status).toBe(409)
    expect(stale.body.documentRevision).toBe(2)
    expect((stale.body.board as BoardDocument).documentRevision).toBe(2)
    expect((stale.body.board as BoardDocument).boardId).toBe('host-test-board-v2')
    expect(String(stale.body.error)).toContain('conflict')
  })

  it('dispatches a batch to an agent, journals the run, and emits events', async () => {
    const projectId = await registerProject()
    await putBoard(projectId, testBoard(), 0)

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
    // An ordinary review dispatch does not belong to a design unit.
    expect(run?.unitId).toBeUndefined()

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
    await putBoard(projectId, testBoard(), 0)
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

  it('answers health checks so the canvas can detect the local app', async () => {
    const health = await api('GET', '/api/health')
    expect(health.status).toBe(200)
    expect(health.body.ok).toBe(true)
  })

  it('rejects generation for an unknown unit with 404 and launches no run', async () => {
    const projectId = await registerProject()
    await putBoard(projectId, boardWithOpenUnit(), 0)
    const result = await api('POST', `/api/projects/${projectId}/generate-options`, { agent: 'claude', unitId: 'ghost', count: 2 })
    expect(result.status).toBe(404)
    expect(String(result.body.error)).toContain('ghost')
    expect((await api('GET', '/api/runs')).body.runs).toHaveLength(0)
  })

  it('rejects generation for a locked unit with 409 and launches no run', async () => {
    const projectId = await registerProject()
    await putBoard(projectId, lockedUnitBoard(), 0)
    const result = await api('POST', `/api/projects/${projectId}/generate-options`, { agent: 'claude', unitId: 'locked-unit', count: 2 })
    expect(result.status).toBe(409)
    expect(String(result.body.error)).toContain('locked')
    expect((await api('GET', '/api/runs')).body.runs).toHaveLength(0)
  })

  it('rejects generation for a blocked unit with 409 naming the dependency, and launches no run', async () => {
    const projectId = await registerProject()
    await putBoard(projectId, blockedUnitBoard(), 0)
    const result = await api('POST', `/api/projects/${projectId}/generate-options`, { agent: 'claude', unitId: 'design-unit', count: 2 })
    expect(result.status).toBe(409)
    expect(String(result.body.error)).toContain('blocked by')
    expect(String(result.body.error)).toContain('Dependency')
    expect((await api('GET', '/api/runs')).body.runs).toHaveLength(0)
  })

  it('accepts generation for an eligible unit, records the unit id, and builds the prompt from its brief and rules', async () => {
    const projectId = await registerProject()
    await putBoard(projectId, boardWithOpenUnit(), 0)
    const result = await api('POST', `/api/projects/${projectId}/generate-options`, { agent: 'claude', unitId: 'design-unit', count: 2 })
    expect(result.status).toBe(202)
    const runId = (result.body.run as AgentRun).id
    expect((result.body.run as AgentRun).unitId).toBe('design-unit')

    // Wait for the journaled prompt to exist, then confirm it carries unit text.
    let prompt = ''
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const promptFile = path.join(dataDir, 'runs', runId, 'prompt.md')
      if (existsSync(promptFile)) { prompt = readFileSync(promptFile, 'utf8'); break }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    expect(prompt).toContain('Pick a direction')
    expect(prompt).toContain('Keep it lo-fi')
  })

  it('copies a unit reference into the run and lists it in the prompt', async () => {
    const projectId = await registerProject()
    const referenceFrame = {
      ...testBoard().frames[0]!,
      id: 'ref-frame',
      label: 'Competitor screen',
      kind: 'reference-image' as const,
      unitId: 'design-unit',
    }
    await putBoard(projectId, { ...boardWithOpenUnit(), frames: [referenceFrame] }, 0)
    const result = await api('POST', `/api/projects/${projectId}/generate-options`, { agent: 'claude', unitId: 'design-unit', count: 2 })
    expect(result.status).toBe(202)
    const runId = (result.body.run as AgentRun).id

    let prompt = ''
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const promptFile = path.join(dataDir, 'runs', runId, 'prompt.md')
      if (existsSync(promptFile)) { prompt = readFileSync(promptFile, 'utf8'); break }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    expect(prompt).toContain('## References')
    expect(prompt).toContain('Competitor screen')
    // The bytes were copied into the run so the agent can open them.
    const referenceFile = path.join(dataDir, 'runs', runId, 'references', '1-competitor-screen.png')
    expect(existsSync(referenceFile)).toBe(true)
  })

  it('feeds a locked dependency winner into a dependent unit prompt', async () => {
    const projectId = await registerProject()
    const setId = 'dep-set'
    // The winning HTML lives on disk where the frame's live source points.
    const scratchDir = path.join(dataDir, 'scratch', projectId, setId)
    mkdirSync(scratchDir, { recursive: true })
    writeFileSync(path.join(scratchDir, 'option-1.html'), '<html><body><main>Left-rail layout wins</main></body></html>')

    const board = feedforwardBoard(projectId, setId)
    await putBoard(projectId, board, 0)

    const result = await api('POST', `/api/projects/${projectId}/generate-options`, { agent: 'claude', unitId: 'design-unit', count: 2 })
    expect(result.status).toBe(202)
    const runId = (result.body.run as AgentRun).id

    let prompt = ''
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const promptFile = path.join(dataDir, 'runs', runId, 'prompt.md')
      if (existsSync(promptFile)) { prompt = readFileSync(promptFile, 'utf8'); break }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    expect(prompt).toContain('Locked decisions this builds on')
    expect(prompt).toContain('Navigation shell')
    expect(prompt).toContain('Locked the left rail.')
    expect(prompt).toContain('dense=true')
    expect(prompt).toContain('Left-rail layout wins')
  })

  it('generates lo-fi options into a per-run scratch dir', async () => {
    // A fake claude that writes two option files into its working directory,
    // which the host sets to the option set's scratch dir.
    const genDataDir = mkdtempSync(path.join(os.tmpdir(), 'design-mode-gen-'))
    const genHost = await startDesignModeHost({
      port: 0,
      dataDir: genDataDir,
      distDir: path.join(genDataDir, 'no-dist'),
      recaptureAfterRun: false,
      agentCommands: {
        claude: {
          executable: 'node',
          args: ['-e', GENERATE_VALID_PAIRS_SCRIPT],
          promptVia: 'stdin',
        },
      },
    })
    try {
      const registered = await fetch(`${genHost.origin}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Gen project',
          path: projectDir,
          devCommand: 'npm run dev',
          devPort: 5184,
          routes: [{ id: 'home', label: 'Home', path: '/' }],
        }),
      })
      const projectId = ((await registered.json()) as { project: { id: string } }).project.id

      await fetch(`${genHost.origin}/api/projects/${projectId}/board`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baseRevision: 0, board: boardWithOpenUnit() }),
      })

      const dispatched = await fetch(`${genHost.origin}/api/projects/${projectId}/generate-options`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent: 'claude', unitId: 'design-unit', count: 2 }),
      })
      expect(dispatched.status).toBe(202)
      const runId = ((await dispatched.json()) as { run: AgentRun }).run.id

      let run: AgentRun | undefined
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const runs = ((await (await fetch(`${genHost.origin}/api/runs`)).json()) as { runs: AgentRun[] }).runs
        run = runs.find((item) => item.id === runId)
        if (run && (run.status === 'done' || run.status === 'failed')) break
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(run?.status).toBe('done')
      expect(run?.annotationIds).toEqual([])

      const scratchDir = path.join(genDataDir, 'scratch', projectId, runId)
      expect(existsSync(path.join(scratchDir, 'option-1.html'))).toBe(true)
      expect(existsSync(path.join(scratchDir, 'option-1.kit.json'))).toBe(true)
      expect(existsSync(path.join(scratchDir, 'option-2.html'))).toBe(true)
      expect(existsSync(path.join(scratchDir, 'option-2.kit.json'))).toBe(true)
      // The run is journaled with its prompt for inspection.
      expect(existsSync(path.join(genDataDir, 'runs', runId, 'prompt.md'))).toBe(true)
    } finally {
      await genHost.close()
      rmSync(genDataDir, { recursive: true, force: true })
    }
  })

  it('captures generated lo-fi options into board frames once the run finishes', async () => {
    const genDataDir = mkdtempSync(path.join(os.tmpdir(), 'design-mode-gen-capture-'))
    const genHost = await startDesignModeHost({
      port: 0,
      dataDir: genDataDir,
      distDir: path.join(genDataDir, 'no-dist'),
      agentCommands: {
        claude: {
          executable: 'node',
          args: ['-e', GENERATE_VALID_PAIRS_SCRIPT],
          promptVia: 'stdin',
        },
      },
    })
    try {
      const registered = await fetch(`${genHost.origin}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Gen capture project',
          path: projectDir,
          devCommand: 'npm run dev',
          devPort: 5185,
          routes: [{ id: 'home', label: 'Home', path: '/' }],
        }),
      })
      const projectId = ((await registered.json()) as { project: { id: string } }).project.id

      await fetch(`${genHost.origin}/api/projects/${projectId}/board`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baseRevision: 0, board: boardWithOpenUnit() }),
      })

      const dispatched = await fetch(`${genHost.origin}/api/projects/${projectId}/generate-options`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent: 'claude', unitId: 'design-unit', count: 2 }),
      })
      const runId = ((await dispatched.json()) as { run: AgentRun }).run.id

      let board: BoardDocument | undefined
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const boardResponse = await fetch(`${genHost.origin}/api/projects/${projectId}/board`)
        if (boardResponse.status === 200) {
          board = (await boardResponse.json() as { board: BoardDocument }).board
          if (board.frames.length === 2) break
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      expect(board?.frames).toHaveLength(2)
      expect(board?.frames.every((frame) => frame.kind === 'playable-option')).toBe(true)
      expect(board?.frames.every((frame) => frame.liveSource !== undefined && frame.kit !== undefined)).toBe(true)
      expect(board?.frames.every((frame) => frame.liveSource?.protocolVersion === 1)).toBe(true)
      // Frame ids are run-scoped; ownership is the durable unit the reviewer made.
      expect(board?.frames.every((frame) => frame.unitId === 'design-unit')).toBe(true)
      expect(board?.frames.map((frame) => frame.id).sort()).toEqual([`${runId}-option-1`, `${runId}-option-2`])
      // Capture never synthesizes a per-run unit; only the reviewer's unit exists.
      expect(board?.units.map((unit) => unit.id)).toEqual(['design-unit'])
      expect(board?.units.some((unit) => unit.id === runId)).toBe(false)
      // The captured board is fully valid, relations included.
      expect(BoardDocumentSchema.safeParse(board).success).toBe(true)
    } finally {
      await genHost.close()
      rmSync(genDataDir, { recursive: true, force: true })
    }
  })

  it('leaves the board unchanged and reports capture-failed when an option pair is bad', async () => {
    const genDataDir = mkdtempSync(path.join(os.tmpdir(), 'design-mode-gen-fail-'))
    const genHost = await startDesignModeHost({
      port: 0,
      dataDir: genDataDir,
      distDir: path.join(genDataDir, 'no-dist'),
      agentCommands: {
        claude: {
          executable: 'node',
          args: ['-e', GENERATE_BAD_SECOND_KIT_SCRIPT],
          promptVia: 'stdin',
        },
      },
    })
    try {
      const registered = await fetch(`${genHost.origin}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Gen fail project',
          path: projectDir,
          devCommand: 'npm run dev',
          devPort: 5186,
          routes: [{ id: 'home', label: 'Home', path: '/' }],
        }),
      })
      const projectId = ((await registered.json()) as { project: { id: string } }).project.id

      // Seed a known board with the target unit, then watch events from here on.
      await fetch(`${genHost.origin}/api/projects/${projectId}/board`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baseRevision: 0, board: { ...testBoard(), units: [openUnit()] } }),
      })

      const seen: HostEvent[] = []
      const eventSource = await fetch(`${genHost.origin}/api/events`)
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

      await fetch(`${genHost.origin}/api/projects/${projectId}/generate-options`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent: 'claude', unitId: 'design-unit', count: 2 }),
      })

      let failure: Extract<HostEvent, { type: 'capture-failed' }> | undefined
      for (let attempt = 0; attempt < 100; attempt += 1) {
        failure = seen.find((event): event is Extract<HostEvent, { type: 'capture-failed' }> => event.type === 'capture-failed')
        if (failure) break
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      expect(failure).toBeDefined()
      expect(failure?.error).toContain('option-2.kit.json')
      // The failed capture never wrote to the board.
      expect(seen.some((event) => event.type === 'board-updated')).toBe(false)

      const boardResponse = await fetch(`${genHost.origin}/api/projects/${projectId}/board`)
      const board = (await boardResponse.json() as { board: BoardDocument }).board
      expect(board.frames).toHaveLength(1)
      expect(board.frames[0]!.id).toBe('home')
      expect(board.frames.some((frame) => frame.kind === 'playable-option')).toBe(false)

      await reader.cancel()
      await readEvents.catch(() => {})
    } finally {
      await genHost.close()
      rmSync(genDataDir, { recursive: true, force: true })
    }
  })

  it('serves scratch HTML with the bridge and a strict content policy, and kit JSON raw', async () => {
    const dir = path.join(dataDir, 'scratch', 'proj-x', 'set-x')
    mkdirSync(dir, { recursive: true })
    const hook = '<meta name="design-mode-playable-bridge" content="1">'
    writeFileSync(path.join(dir, 'option-1.html'), `<html><head>${hook}</head><body><button>Hi</button></body></html>`)
    writeFileSync(path.join(dir, 'option-1.kit.json'), '{"manifestVersion":1,"controls":[{"kind":"toggle","id":"dense","label":"Dense","default":false}]}')

    const htmlResponse = await fetch(`${host.origin}/scratch/proj-x/set-x/option-1.html`)
    expect(htmlResponse.status).toBe(200)
    expect(htmlResponse.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(htmlResponse.headers.get('content-security-policy')).toContain('script-src ')
    expect(htmlResponse.headers.get('cache-control')).toBe('no-store')
    expect(htmlResponse.headers.get('x-content-type-options')).toBe('nosniff')
    const html = await htmlResponse.text()
    expect(html).toContain('data-design-mode-playable')

    const jsonResponse = await fetch(`${host.origin}/scratch/proj-x/set-x/option-1.kit.json`)
    expect(jsonResponse.status).toBe(200)
    expect(jsonResponse.headers.get('content-type')).toContain('application/json')
    expect(jsonResponse.headers.get('content-security-policy')).toBeNull()
    const json = await jsonResponse.text()
    expect(json).not.toContain('data-design-mode-playable')
  })

  it('refuses to serve scratch HTML that lacks the bridge hook', async () => {
    const dir = path.join(dataDir, 'scratch', 'proj-y', 'set-y')
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'option-1.html'), '<html><body>no hook</body></html>')
    const response = await fetch(`${host.origin}/scratch/proj-y/set-y/option-1.html`)
    expect(response.status).toBe(422)
  })

  it('ingests canvas events into the board, journals jsonl, and emits board-patched', async () => {
    const projectId = await registerProject()
    await putBoard(projectId, testBoard(), 0)

    const runId = 'canvas-event-run'
    const runDir = path.join(dataDir, 'runs', runId)
    mkdirSync(runDir, { recursive: true })
    writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({
      id: runId,
      projectId,
      agent: 'claude',
      status: 'running',
      annotationIds: [],
      startedAt: new Date().toISOString(),
      outputTail: '',
    }, null, 2))

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
        if (seen.some((event) => event.type === 'board-patched')) break
      }
    })()

    const created = await api('POST', `/api/runs/${runId}/canvas-events`, {
      schemaVersion: 1,
      id: 'q-1',
      type: 'question',
      frameId: 'home',
      anchor: [0.4, 0.25],
      text: 'What does this hero promise?',
      createdAt: new Date().toISOString(),
    })
    expect(created.status).toBe(201)
    expect(created.body.applied).toBe(true)
    const board = created.body.board as BoardDocument
    expect(board.documentRevision).toBe(2)
    expect(board.annotations).toEqual([expect.objectContaining({
      id: 'q-1',
      role: 'agent-question',
      instruction: 'What does this hero promise?',
      runId,
      canvasEventId: 'q-1',
    })])

    const jsonl = readFileSync(path.join(runDir, 'canvas-events.jsonl'), 'utf8').trim()
    expect(JSON.parse(jsonl)).toMatchObject({ id: 'q-1', type: 'question', runId })

    await Promise.race([
      readEvents,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timed out waiting for board-patched')), 3_000)),
    ])
    reader.cancel().catch(() => {})
    const patch = seen.find((event) => event.type === 'board-patched')
    expect(patch).toMatchObject({
      type: 'board-patched',
      projectId,
      documentRevision: 2,
      runId,
      records: [{ kind: 'annotation', annotation: expect.objectContaining({ id: 'q-1', role: 'agent-question' }) }],
    })

    const deduped = await api('POST', `/api/runs/${runId}/canvas-events`, {
      schemaVersion: 1,
      id: 'q-1',
      type: 'question',
      frameId: 'home',
      anchor: [0.4, 0.25],
      text: 'What does this hero promise?',
      createdAt: new Date().toISOString(),
    })
    expect(deduped.status).toBe(200)
    expect(deduped.body.applied).toBe(false)
    expect((deduped.body.board as BoardDocument).documentRevision).toBe(2)
    expect(readFileSync(path.join(runDir, 'canvas-events.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1)

    const unknownFrame = await api('POST', `/api/runs/${runId}/canvas-events`, {
      schemaVersion: 1,
      id: 'q-missing',
      type: 'question',
      frameId: 'ghost',
      anchor: [0.5, 0.5],
      text: 'Missing frame',
      createdAt: new Date().toISOString(),
    })
    expect(unknownFrame.status).toBe(400)
    expect(String(unknownFrame.body.error)).toContain('unknown-frame')

    writeFileSync(path.join(runDir, 'canvas-events.jsonl'), `${jsonl}\n${JSON.stringify({
      schemaVersion: 1,
      id: 't-1',
      type: 'teach-answer',
      runId,
      frameId: 'home',
      anchor: [0.2, 0.2],
      instruction: 'This is the marketing hero.',
      createdAt: new Date().toISOString(),
    })}\n`)
    const synced = await api('POST', `/api/runs/${runId}/canvas-events/sync`)
    expect(synced.status).toBe(200)
    expect(synced.body.applied).toBe(1)
    expect((synced.body.board as BoardDocument).annotations.map((item) => item.id).sort()).toEqual(['q-1', 't-1'])
    expect((synced.body.board as BoardDocument).annotations.find((item) => item.id === 't-1')?.role).toBe('teach')
  })

  it('rejects a learn request for a frame that is not on the board with 404', async () => {
    const projectId = await registerProject()
    await putBoard(projectId, testBoard(), 0)
    const requestId = '2b1c0e1a-0000-4000-8000-000000000000'
    const rejected = await api('POST', `/api/projects/${projectId}/learn`, {
      agent: 'claude',
      frameId: 'ghost',
      anchor: [0.5, 0.5],
      question: 'What is this?',
      requestId,
    })
    expect(rejected.status).toBe(404)
    expect(String(rejected.body.error)).toContain('ghost')
  })

  it('answers a learn request by pinning a teach annotation matched by request id', async () => {
    const learnDataDir = mkdtempSync(path.join(os.tmpdir(), 'design-mode-learn-'))
    const learnHost = await startDesignModeHost({
      port: 0,
      dataDir: learnDataDir,
      distDir: path.join(learnDataDir, 'no-dist'),
      recaptureAfterRun: false,
      agentCommands: {
        claude: { executable: 'node', args: ['-e', TEACH_ANSWER_SCRIPT], promptVia: 'stdin' },
      },
    })
    try {
      const registered = await fetch(`${learnHost.origin}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Learn project',
          path: projectDir,
          devCommand: 'npm run dev',
          devPort: 5186,
          routes: [{ id: 'home', label: 'Home', path: '/' }],
        }),
      })
      const projectId = ((await registered.json()) as { project: { id: string } }).project.id

      await fetch(`${learnHost.origin}/api/projects/${projectId}/board`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baseRevision: 0, board: testBoard() }),
      })

      const requestId = '2b1c0e1a-0000-4000-8000-000000000000'
      const asked = await fetch(`${learnHost.origin}/api/projects/${projectId}/learn`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agent: 'claude',
          frameId: 'home',
          anchor: [0.4, 0.7],
          question: 'What is this control called?',
          requestId,
        }),
      })
      expect(asked.status).toBe(202)

      let teach: BoardDocument['annotations'][number] | undefined
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const boardResponse = await fetch(`${learnHost.origin}/api/projects/${projectId}/board`)
        if (boardResponse.status === 200) {
          const board = (await boardResponse.json() as { board: BoardDocument }).board
          teach = board.annotations.find((item) => item.role === 'teach')
          if (teach) break
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      expect(teach).toBeDefined()
      expect(teach?.requestId).toBe(requestId)
      expect(teach?.frameId).toBe('home')
      expect(teach?.instruction).toBe('That is the primary submit button.')
    } finally {
      await learnHost.close()
      rmSync(learnDataDir, { recursive: true, force: true })
    }
  })
})
