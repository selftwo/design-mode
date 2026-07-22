import { describe, expect, it } from 'vitest'
import {
  AgentRunSchema,
  GenerateOptionsRequestSchema,
  HostEventSchema,
  LearnRequestSchema,
} from './host-api.schema'

function runFields() {
  return {
    id: 'run-1',
    projectId: 'proj-1',
    agent: 'claude',
    status: 'running',
    annotationIds: [],
    startedAt: new Date().toISOString(),
    outputTail: '',
  }
}

describe('GenerateOptionsRequestSchema', () => {
  it('accepts a unit-scoped request and defaults the count', () => {
    const parsed = GenerateOptionsRequestSchema.parse({ agent: 'claude', unitId: 'unit-1' })
    expect(parsed).toEqual({ agent: 'claude', unitId: 'unit-1', count: 3 })
  })

  it('rejects a legacy prompt-only request', () => {
    expect(GenerateOptionsRequestSchema.safeParse({ agent: 'claude', prompt: 'hi', count: 2 }).success).toBe(false)
  })

  it('rejects an unknown extra field such as a stray prompt', () => {
    expect(GenerateOptionsRequestSchema.safeParse({ agent: 'claude', unitId: 'unit-1', prompt: 'hi' }).success).toBe(false)
  })
})

describe('LearnRequestSchema', () => {
  const valid = {
    agent: 'claude',
    frameId: 'home',
    anchor: [0.5, 0.5],
    question: 'What is this?',
    requestId: '2b1c0e1a-0000-4000-8000-000000000000',
  }

  it('accepts a well-formed learn request, with an optional element label', () => {
    expect(LearnRequestSchema.safeParse(valid).success).toBe(true)
    expect(LearnRequestSchema.safeParse({ ...valid, elementLabel: 'Submit' }).success).toBe(true)
  })

  it('requires a uuid request id and a non-empty question', () => {
    expect(LearnRequestSchema.safeParse({ ...valid, requestId: 'not-a-uuid' }).success).toBe(false)
    expect(LearnRequestSchema.safeParse({ ...valid, question: '' }).success).toBe(false)
  })

  it('rejects an unknown extra field such as a stray prompt', () => {
    expect(LearnRequestSchema.safeParse({ ...valid, prompt: 'hi' }).success).toBe(false)
  })
})

describe('AgentRunSchema', () => {
  it('accepts an ordinary review run with no unit', () => {
    const parsed = AgentRunSchema.parse(runFields())
    expect(parsed.unitId).toBeUndefined()
  })

  it('accepts a generation run that carries a unit id', () => {
    const parsed = AgentRunSchema.parse({ ...runFields(), unitId: 'unit-1' })
    expect(parsed.unitId).toBe('unit-1')
  })
})

describe('HostEventSchema', () => {
  it('parses a run-updated event carrying either run form', () => {
    expect(HostEventSchema.safeParse({ type: 'run-updated', run: runFields() }).success).toBe(true)
    expect(HostEventSchema.safeParse({ type: 'run-updated', run: { ...runFields(), unitId: 'unit-1' } }).success).toBe(true)
  })

  it('parses a board-patched event with an agent annotation record', () => {
    const parsed = HostEventSchema.safeParse({
      type: 'board-patched',
      projectId: 'proj-1',
      documentRevision: 3,
      runId: 'run-1',
      records: [{
        kind: 'annotation',
        annotation: {
          id: 'q-1',
          frameId: 'home',
          role: 'agent-question',
          status: 'draft',
          instruction: 'What is this?',
          anchor: [0.5, 0.5],
          mark: null,
          createdAt: '2026-07-22T00:00:00.000Z',
          madeAgainstCaptureHash: 'hash',
          madeAgainstRevision: 1,
          runId: 'run-1',
          canvasEventId: 'q-1',
        },
      }],
    })
    expect(parsed.success).toBe(true)
  })
})
