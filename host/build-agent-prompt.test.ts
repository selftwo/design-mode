import { describe, expect, it } from 'vitest'
import type { ReviewBatch } from '../src/features/review-board/model/review-batch.ts'
import type { Project } from '../src/features/local-host/host-api.schema.ts'
import { buildAgentPrompt } from './build-agent-prompt.ts'

const project: Project = {
  id: 'demo-1234',
  name: 'Demo',
  path: '/tmp/demo',
  devCommand: 'npm run dev',
  devPort: 5183,
  routes: [{ id: 'home', label: 'Home', path: '/' }],
  registeredAt: '2026-07-16T10:00:00.000Z',
}

const batch: ReviewBatch = {
  schemaVersion: 1,
  boardId: 'demo-board',
  exportedAt: '2026-07-16T11:00:00.000Z',
  annotations: [
    {
      schemaVersion: 1,
      id: 'note-1',
      status: 'draft',
      instruction: 'Make the primary action unmistakable',
      intent: 'bolder',
      frameId: 'home',
      route: '/',
      viewport: { width: 1440, height: 900 },
      fullScreenshot: 'screens/home.png',
      crop: null,
      elements: [{ id: 'home-el-1', label: 'Start estimate', bounds: [[0.1, 0.2], [0.3, 0.3]] }],
      marks: [{ kind: 'element', elementId: 'home-el-1', label: 'Start estimate', points: [[0.1, 0.2], [0.3, 0.3]] }],
      anchor: [0.2, 0.25],
      madeAgainst: { sha: null, timestamp: '2026-07-16T10:30:00.000Z', captureHash: 'hash', revision: 1 },
    },
  ],
}

describe('buildAgentPrompt', () => {
  it('carries context files, intent guidance, marks, and instructions', () => {
    const prompt = buildAgentPrompt({
      project,
      batch,
      contextFiles: [{ name: 'DESIGN.md', content: 'Use the plum accent for primary actions.' }],
      screenshotDirectory: '/runs/run-1/screens',
    })
    expect(prompt).toContain('/tmp/demo')
    expect(prompt).toContain('### DESIGN.md')
    expect(prompt).toContain('plum accent')
    expect(prompt).toContain('Design intent: bolder')
    expect(prompt).toContain('Increase visual weight')
    expect(prompt).toContain('picked element "Start estimate"')
    expect(prompt).toContain('Make the primary action unmistakable')
    expect(prompt).toContain('/runs/run-1/screens/home.png')
  })

  it('truncates oversized context files instead of flooding the prompt', () => {
    const prompt = buildAgentPrompt({
      project,
      batch,
      contextFiles: [{ name: 'README.md', content: 'x'.repeat(20_000) }],
      screenshotDirectory: '/runs/run-1/screens',
    })
    expect(prompt).toContain('… (truncated)')
    expect(prompt.length).toBeLessThan(15_000)
  })
})
