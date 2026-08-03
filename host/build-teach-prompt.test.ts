import { describe, expect, it } from 'vitest'
import type { LearnRequest, Project } from '../src/features/local-host/host-api.schema.ts'
import type { TeachQuestion } from '../src/features/review-board/model/teach-question.schema.ts'
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

const learnPromptArgs = {
  project: projectFixture(),
  runId: 'run-9',
  contextFiles: [] as Array<{ name: string; content: string }>,
  screenshotPath: '/data/runs/run-9/screens/home.png',
  canvasEventsPath: '/data/runs/run-9/canvas-events.jsonl',
  createdAt: '2026-07-22T00:00:00.000Z',
}

const teachQuestion: TeachQuestion = {
  schemaVersion: 1,
  frameId: 'pricing',
  route: '/pricing',
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
}

describe('buildTeachPrompt', () => {
  it('states the question, anchor, frame, and the explain-only rule for learn runs', () => {
    const prompt = buildTeachPrompt({ ...learnPromptArgs, request: requestFixture() })
    expect(prompt).toContain('What is this control called?')
    expect(prompt).toContain('[0.4,0.7]')
    expect(prompt).toContain('home')
    expect(prompt).toContain('/data/runs/run-9/screens/home.png')
    expect(prompt).toContain('Do not edit the project')
    expect(prompt).toContain('**bolder**')
  })

  it('names the element when the reviewer picked one', () => {
    const prompt = buildTeachPrompt({ ...learnPromptArgs, request: requestFixture({ elementLabel: 'Sign in button' }) })
    expect(prompt).toContain('Sign in button')
  })

  it('embeds a teach-answer template that validates once the placeholders are filled', () => {
    const prompt = buildTeachPrompt({ ...learnPromptArgs, request: requestFixture() })
    expect(prompt).toContain('/data/runs/run-9/canvas-events.jsonl')
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

  it('includes project design context when provided for learn runs', () => {
    const prompt = buildTeachPrompt({
      ...learnPromptArgs,
      request: requestFixture(),
      contextFiles: [{ name: 'DESIGN.md', content: 'Primary color is plum.' }],
    })
    expect(prompt).toContain('Project design context')
    expect(prompt).toContain('Primary color is plum.')
  })

  it('asks for explanation only and carries anatomy plus vocabulary for teach questions', () => {
    const prompt = buildTeachPrompt({
      project: {
        id: 'demo',
        name: 'Demo',
        path: '/tmp/demo',
        devCommand: 'npm run dev',
        devPort: 3000,
        routes: [{ id: 'pricing', label: 'Pricing', path: '/pricing' }],
        registeredAt: new Date().toISOString(),
      },
      question: teachQuestion,
      contextFiles: [{ name: 'DESIGN.md', content: 'Primary color is plum.' }],
    })
    expect(prompt).toContain('Explain only')
    expect(prompt).toContain('plan-keep = button')
    expect(prompt).toContain('**signal**')
    expect(prompt).toContain('Why does this card read heavier')
    expect(prompt).toContain('Primary color is plum.')
    expect(prompt).toContain('**bolder**')
  })
})
