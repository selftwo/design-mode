import { describe, expect, it } from 'vitest'
import type { TeachQuestion } from '../src/features/review-board/model/teach-question.schema.ts'
import { buildTeachPrompt } from './build-teach-prompt.ts'

const question: TeachQuestion = {
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
  it('asks for explanation only and carries anatomy plus vocabulary', () => {
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
      question,
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
