import { describe, expect, it } from 'vitest'
import type { LearnRequest, Project } from '../src/features/local-host/host-api.schema.ts'
import { CanvasEventSchema } from '../src/features/review-board/model/canvas-event.schema.ts'
import { buildTeachPrompt } from './build-teach-prompt.ts'

function projectFixture(): Project {
  return {
    id: 'demo-1234',
    name: 'Demo',
    path: '/tmp/demo',
    devCommand: 'npm run dev',
    devPort: 5173,
    routes: [{ id: 'home', label: 'Home', path: '/' }],
    registeredAt: new Date().toISOString(),
  }
}

function requestFixture(overrides: Partial<LearnRequest> = {}): LearnRequest {
  return {
    agent: 'claude',
    frameId: 'home',
    anchor: [0.4, 0.7],
    question: 'What is this control called?',
    requestId: '2b1c0e1a-0000-4000-8000-000000000000',
    ...overrides,
  }
}

const promptArgs = {
  project: projectFixture(),
  runId: 'run-9',
  contextFiles: [],
  screenshotPath: '/data/runs/run-9/screens/home.png',
  canvasEventsPath: '/data/runs/run-9/canvas-events.jsonl',
  createdAt: '2026-07-22T00:00:00.000Z',
}

describe('buildTeachPrompt', () => {
  it('states the question, anchor, frame, and the explain-only rule', () => {
    const prompt = buildTeachPrompt({ ...promptArgs, request: requestFixture() })
    expect(prompt).toContain('What is this control called?')
    expect(prompt).toContain('[0.4,0.7]')
    expect(prompt).toContain('home')
    expect(prompt).toContain('/data/runs/run-9/screens/home.png')
    expect(prompt).toContain('Do not edit the project')
  })

  it('names the element when the reviewer picked one', () => {
    const prompt = buildTeachPrompt({ ...promptArgs, request: requestFixture({ elementLabel: 'Sign in button' }) })
    expect(prompt).toContain('Sign in button')
  })

  it('embeds a teach-answer template that validates once the placeholders are filled', () => {
    const prompt = buildTeachPrompt({ ...promptArgs, request: requestFixture() })
    expect(prompt).toContain('/data/runs/run-9/canvas-events.jsonl')
    // The template line is the last JSON object in the prompt; pull it out and
    // check it becomes a valid canvas event once the agent fills its two slots.
    const template = prompt.split('\n').find((line) => line.startsWith('{'))
    expect(template).toBeTruthy()
    const filled = template!.replace('"ID"', '"teach-1"').replace('INSTRUCTION', 'That is the primary submit button.')
    const parsed = CanvasEventSchema.safeParse(JSON.parse(filled))
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.type).toBe('teach-answer')
      expect(parsed.data.runId).toBe('run-9')
      if (parsed.data.type === 'teach-answer') {
        expect(parsed.data.requestId).toBe('2b1c0e1a-0000-4000-8000-000000000000')
      }
    }
  })

  it('includes project design context when provided', () => {
    const prompt = buildTeachPrompt({
      ...promptArgs,
      request: requestFixture(),
      contextFiles: [{ name: 'DESIGN.md', content: 'Primary color is plum.' }],
    })
    expect(prompt).toContain('Project design context')
    expect(prompt).toContain('Primary color is plum.')
  })
})
