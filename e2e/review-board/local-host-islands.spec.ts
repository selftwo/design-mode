import { expect, test, type Page } from '@playwright/test'
import type { BoardDocument } from '../../src/features/review-board/model/board-document.schema'
import { ReviewAnnotationSchema } from '../../src/features/review-board/model/board-document.schema'
import {
  AgentRunSchema,
  BoardPutRequestSchema,
  GenerateOptionsRequestSchema,
  HostEventSchema,
  LearnRequestSchema,
  type AgentRun,
  type HostEvent,
} from '../../src/features/local-host/host-api.schema'
import { buildPlayableBoard, installPlayableOptionRoutes } from './install-playable-option-routes'

// The host-gated islands (UnitQueueIsland, GenerateOptionsPanel, LearnAskIsland,
// RunsIsland) render only when the local host serves the page. This spec fakes
// that host: __designModeHost is injected before load, the HTTP API is answered
// by page.route, and the /api/events SSE stream is a stubbed EventSource the
// tests push host events through. Every faked payload is parsed with the real
// host-api Zod schemas first, so fixture drift fails in the fixture.

const PROJECT_ID = 'proj-1'

interface Diagnostics {
  frames: Array<{ id: string; lifeState: string }>
  units: Array<{ id: string; state: string }>
  annotations: Array<{ id: string; frameId: string; instruction: string }>
}

async function diagnostics(page: Page): Promise<Diagnostics> {
  return JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '{}') as Diagnostics
}

// A valid AgentRun with test defaults, parsed so a schema change fails loudly.
function agentRun(overrides: Partial<AgentRun> & { id: string }): AgentRun {
  return AgentRunSchema.parse({
    projectId: PROJECT_ID,
    agent: 'claude',
    status: 'queued',
    annotationIds: [],
    startedAt: new Date().toISOString(),
    outputTail: '',
    ...overrides,
  })
}

interface FakeLocalHost {
  boardPuts: unknown[]
  generateBodies: unknown[]
  learnBodies: unknown[]
  // Served by GET /api/runs, so a stream resync after a reconnect sees the same
  // runs the tests emitted over the fake SSE stream.
  runsList: AgentRun[]
}

// The fake local host: __designModeHost plus the HTTP API the local-host client
// speaks. The SSE endpoint is faked by replacing EventSource with a stub that
// registers itself on the window; tests deliver events and connection changes
// by invoking the stub's callbacks, which is exactly what a real stream does.
async function installFakeLocalHost(page: Page, board: BoardDocument): Promise<FakeLocalHost> {
  const fake: FakeLocalHost = { boardPuts: [], generateBodies: [], learnBodies: [], runsList: [] }

  await page.addInitScript(() => {
    ;(window as unknown as { __designModeHost: { version: number } }).__designModeHost = { version: 1 }
    class FakeEventSource {
      url: string
      readyState = 0
      onopen: ((event: Event) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      onmessage: ((event: { data: string }) => void) | null = null
      constructor(url: string) {
        this.url = url
        const holder = window as unknown as { __fakeEventSources?: FakeEventSource[] }
        holder.__fakeEventSources = holder.__fakeEventSources ?? []
        holder.__fakeEventSources.push(this)
        setTimeout(() => {
          if (this.readyState !== 0) return
          this.readyState = 1
          this.onopen?.(new Event('open'))
        }, 0)
      }
      close() {
        this.readyState = 2
      }
    }
    ;(window as unknown as { EventSource: unknown }).EventSource = FakeEventSource
  })

  // Registered first so later, more specific routes win: an endpoint this fake
  // does not implement fails as a host error, never as Vite's index.html.
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 404, json: { error: `Unexpected request: ${route.request().method()} ${route.request().url()}` } })
  })
  await page.route('**/api/agents', async (route) => {
    await route.fulfill({ json: { agents: [{ id: 'claude', available: true }, { id: 'codex', available: false }] } })
  })
  await page.route('**/api/runs', async (route) => {
    await route.fulfill({ json: { runs: fake.runsList } })
  })
  await page.route(`**/api/projects/${PROJECT_ID}/context`, async (route) => {
    await route.fulfill({ json: { files: [] } })
  })
  await page.route(`**/api/projects/${PROJECT_ID}/board`, async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { baseRevision: number; board: BoardDocument }
      fake.boardPuts.push(body)
      // Compare-and-save: the host alone assigns the next revision.
      await route.fulfill({ json: { board: { ...body.board, documentRevision: body.baseRevision + 1 } } })
      return
    }
    await route.fulfill({ json: { board } })
  })
  await page.route(`**/api/projects/${PROJECT_ID}/generate-options`, async (route) => {
    fake.generateBodies.push(route.request().postDataJSON())
    await route.fulfill({ json: { run: agentRun({ id: 'run-generate-1', status: 'queued', unitId: 'unit-1' }) } })
  })
  await page.route(`**/api/projects/${PROJECT_ID}/learn`, async (route) => {
    fake.learnBodies.push(route.request().postDataJSON())
    await route.fulfill({ json: { run: agentRun({ id: 'run-learn-1', status: 'running' }) } })
  })

  return fake
}

async function openHostBoard(page: Page, screenCount: number) {
  await page.goto(`/?engine=reactflow&project=${PROJECT_ID}`)
  await expect(page.getByTestId('board-status')).toContainText(`${screenCount} screens`, { timeout: 30_000 })
}

// The app subscribes to host events after the board mounts; wait until a live
// stub has a message handler before pushing events through it.
async function waitForEventStream(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const holder = window as unknown as { __fakeEventSources?: Array<{ readyState: number; onmessage: unknown }> }
    return (holder.__fakeEventSources ?? []).some((source) => source.readyState === 1 && source.onmessage !== null)
  })).toBe(true)
}

async function emitHostEvent(page: Page, event: HostEvent) {
  await page.evaluate((payload) => {
    const holder = window as unknown as {
      __fakeEventSources?: Array<{ readyState: number; onmessage: ((event: { data: string }) => void) | null }>
    }
    for (const source of holder.__fakeEventSources ?? []) {
      if (source.readyState === 1) source.onmessage?.({ data: JSON.stringify(payload) })
    }
  }, HostEventSchema.parse(event))
}

async function setStreamState(page: Page, state: 'dropped' | 'reconnected') {
  await page.evaluate((next) => {
    const holder = window as unknown as {
      __fakeEventSources?: Array<{
        readyState: number
        onerror: ((event: Event) => void) | null
        onopen: ((event: Event) => void) | null
      }>
    }
    for (const source of holder.__fakeEventSources ?? []) {
      if (source.readyState !== 1) continue
      if (next === 'dropped') source.onerror?.(new Event('error'))
      else source.onopen?.(new Event('open'))
    }
  }, state)
}

test('local host: the unit queue lists host units and a form-submitted unit reaches queue, document, and PUT payload', async ({ page }) => {
  await installPlayableOptionRoutes(page)
  const fake = await installFakeLocalHost(page, buildPlayableBoard(2))
  await openHostBoard(page, 2)

  // The island renders from the host board.
  await expect(page.getByTestId('unit-queue-island')).toBeVisible()
  await expect(page.getByTestId('unit-queue-row-unit-1')).toContainText('Options')
  await expect(page.getByTestId('unit-queue-state-unit-1')).toHaveText('Open')

  // Create a unit through the real form; Enter in a field submits it.
  await page.getByTestId('unit-queue-add').click()
  await page.getByTestId('unit-create-label').fill('Nav header')
  await page.getByTestId('unit-create-brief').fill('Choose the header direction')
  await page.getByTestId('unit-create-label').press('Enter')

  await expect(page.getByTestId('unit-queue-list')).toContainText('Nav header')
  const units = (await diagnostics(page)).units
  expect(units).toHaveLength(2)
  const created = units.find((unit) => unit.id !== 'unit-1')!
  expect(created.id).toMatch(/^nav-header-/)
  expect(created.state).toBe('open')
  await expect(page.getByTestId(`unit-queue-row-${created.id}`)).toBeVisible()

  // Autosave PUTs the changed board through compare-and-save with the new unit.
  await expect.poll(() => fake.boardPuts.length).toBeGreaterThan(0)
  const put = BoardPutRequestSchema.parse(fake.boardPuts.at(-1))
  expect(put.baseRevision).toBe(1)
  expect(put.board.units.map((unit) => unit.label)).toEqual(['Options', 'Nav header'])
})

test('local host: generate options saves first, POSTs unit id and count, and the sent phase survives a collapse', async ({ page }) => {
  await installPlayableOptionRoutes(page)
  const fake = await installFakeLocalHost(page, buildPlayableBoard(2))
  await openHostBoard(page, 2)

  // The first unit is selected by default and eligible.
  await expect(page.getByTestId('generate-options-form')).toBeVisible()
  await expect(page.getByTestId('generate-options-unit')).toHaveText('Options')

  await page.getByTestId('generate-options-count').selectOption('2')
  await page.getByTestId('generate-options-submit').click()
  await expect(page.getByTestId('generate-options-notice')).toHaveText('Started options for Options.')

  // Exactly one generation request, carrying the unit id and count, no prompt.
  expect(fake.generateBodies).toHaveLength(1)
  const request = GenerateOptionsRequestSchema.parse(fake.generateBodies[0])
  expect(request).toMatchObject({ agent: 'claude', unitId: 'unit-1', count: 2 })
  // The save gate ran before the run was asked for.
  expect(fake.boardPuts.length).toBeGreaterThan(0)

  // Collapsing unmounts the panel; the lifted phase must survive and reappear.
  await page.getByTestId('toggle-unit-queue').click()
  await expect(page.getByTestId('unit-queue-island')).toHaveCount(0)
  await page.getByTestId('toggle-unit-queue').click()
  await expect(page.getByTestId('unit-queue-island')).toBeVisible()
  await expect(page.getByTestId('generate-options-notice')).toHaveText('Started options for Options.')
  expect(fake.generateBodies).toHaveLength(1)
})

test('local host: a learn ask POSTs the question and a board-patched teach answer resolves the pending count', async ({ page }) => {
  await installPlayableOptionRoutes(page)
  const fake = await installFakeLocalHost(page, buildPlayableBoard(2))
  await openHostBoard(page, 2)
  await waitForEventStream(page)

  await page.getByTestId('surface-p0').click({ position: { x: 10, y: 10 } })
  await expect(page.getByTestId('learn-ask-island')).toBeVisible()

  await page.getByTestId('learn-ask-input').fill('How is the header built?')
  await page.getByTestId('learn-ask-submit').click()
  await expect(page.getByTestId('learn-ask-pending')).toHaveText('1 waiting for an answer')

  expect(fake.learnBodies).toHaveLength(1)
  const ask = LearnRequestSchema.parse(fake.learnBodies[0])
  expect(ask).toMatchObject({
    agent: 'claude',
    frameId: 'p0',
    anchor: [0.5, 0.5],
    question: 'How is the header built?',
  })

  // The answer arrives as a teach annotation over the board-patched stream,
  // echoing the ask's requestId (see use-agent-collaboration).
  const answer = ReviewAnnotationSchema.parse({
    id: 'teach-answer-1',
    frameId: 'p0',
    role: 'teach',
    status: 'draft',
    instruction: 'The header is a flex row with a sticky wrapper.',
    anchor: [0.5, 0.5],
    mark: null,
    createdAt: new Date().toISOString(),
    madeAgainstCaptureHash: 'p0-hash',
    madeAgainstRevision: 1,
    runId: 'run-learn-1',
    requestId: ask.requestId,
  })
  await emitHostEvent(page, {
    type: 'board-patched',
    projectId: PROJECT_ID,
    documentRevision: 2,
    runId: 'run-learn-1',
    records: [{ kind: 'annotation', annotation: answer }],
  })

  // The pending ask resolves and the pinned answer opens at its anchor.
  await expect(page.getByTestId('learn-ask-pending')).toHaveCount(0)
  await expect(page.getByTestId('selected-annotation')).toHaveText('teach-answer-1')
  await expect(page.getByTestId('annotation-count')).toHaveText('1 annotation')
  const merged = (await diagnostics(page)).annotations.find((item) => item.id === 'teach-answer-1')
  expect(merged).toMatchObject({ frameId: 'p0', instruction: 'The header is a flex row with a sticky wrapper.' })
})

test('local host: a run-updated stream event renders the run and later events update it in place', async ({ page }) => {
  await installPlayableOptionRoutes(page)
  const fake = await installFakeLocalHost(page, buildPlayableBoard(2))
  await openHostBoard(page, 2)
  await waitForEventStream(page)

  // No runs yet: the island stays off the canvas.
  await expect(page.getByTestId('agent-activity')).toHaveCount(0)

  const running = agentRun({ id: 'run-42', status: 'running', unitId: 'unit-1', outputTail: 'Sketching options' })
  fake.runsList.push(running)
  await emitHostEvent(page, { type: 'run-updated', run: running })

  await expect(page.getByTestId('agent-activity')).toBeVisible()
  await expect(page.getByTestId('agent-run-run-42')).toBeVisible()
  await expect(page.getByTestId('agent-run-status-run-42')).toHaveText('working on design options')

  const finished = agentRun({
    id: 'run-42',
    status: 'done',
    unitId: 'unit-1',
    startedAt: running.startedAt,
    finishedAt: new Date().toISOString(),
    outputTail: 'Wrote 2 options',
  })
  fake.runsList.splice(0, fake.runsList.length, finished)
  await emitHostEvent(page, { type: 'run-updated', run: finished })

  // Same row, updated in place, not a second entry.
  await expect(page.getByTestId('agent-run-status-run-42')).toHaveText('finished design options')
  await expect(page.locator('[data-testid^="agent-run-run-42"]')).toHaveCount(1)
})

test('local host: a dropped event stream shows the connection notice until the stream reopens', async ({ page }) => {
  await installPlayableOptionRoutes(page)
  await installFakeLocalHost(page, buildPlayableBoard(2))
  await openHostBoard(page, 2)
  await waitForEventStream(page)

  await expect(page.getByTestId('host-connection-notice')).toHaveCount(0)

  await setStreamState(page, 'dropped')
  await expect(page.getByTestId('host-connection-notice')).toContainText('reconnecting')

  await setStreamState(page, 'reconnected')
  await expect(page.getByTestId('host-connection-notice')).toHaveCount(0)
})
