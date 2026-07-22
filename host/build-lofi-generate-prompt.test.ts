import { describe, expect, it } from 'vitest'
import type { Project } from '../src/features/local-host/host-api.schema.ts'
import type { DesignUnit } from '../src/features/review-board/model/board-document.schema.ts'
import { buildLofiGeneratePrompt } from './build-lofi-generate-prompt.ts'

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

function unitFixture(overrides: Partial<DesignUnit> = {}): DesignUnit {
  return {
    id: 'unit-1',
    label: 'Sign-in screen',
    brief: 'A sign-in screen for a banking app',
    rules: ['Use one primary action', 'No social login'],
    dependsOnUnitIds: [],
    state: 'open',
    ...overrides,
  }
}

describe('buildLofiGeneratePrompt', () => {
  it('builds the request from the unit label, brief, and rules', () => {
    const prompt = buildLofiGeneratePrompt({
      project: projectFixture(),
      unit: unitFixture(),
      count: 3,
      outputDir: '/data/scratch/demo-1234/set-1',
      contextFiles: [],
    })
    expect(prompt).toContain('Sign-in screen')
    expect(prompt).toContain('A sign-in screen for a banking app')
    expect(prompt).toContain('- Use one primary action')
    expect(prompt).toContain('- No social login')
    expect(prompt).toContain('option-1.html')
    expect(prompt).toContain('option-1.kit.json')
    expect(prompt).toContain('/data/scratch/demo-1234/set-1')
    expect(prompt).toContain('self-contained')
    expect(prompt).toContain('low fidelity')
    // No design-context section when none is provided.
    expect(prompt).not.toContain('Project design context')
  })

  it('states there are no extra rules when the unit has none', () => {
    const prompt = buildLofiGeneratePrompt({
      project: projectFixture(),
      unit: unitFixture({ rules: [] }),
      count: 2,
      outputDir: '/data/scratch/demo-1234/set-1',
      contextFiles: [],
    })
    expect(prompt).toContain('No extra rules.')
  })

  it('requires the playable bridge hook and bans authored scripts', () => {
    const prompt = buildLofiGeneratePrompt({
      project: projectFixture(),
      unit: unitFixture(),
      count: 2,
      outputDir: '/data/scratch/demo-1234/set-1',
      contextFiles: [],
    })
    expect(prompt).toContain('design-mode-playable-bridge')
    expect(prompt).toContain('no `<script>`')
  })

  it('states the kit manifest shape and rules', () => {
    const prompt = buildLofiGeneratePrompt({
      project: projectFixture(),
      unit: unitFixture(),
      count: 2,
      outputDir: '/data/scratch/demo-1234/set-1',
      contextFiles: [],
    })
    expect(prompt).toContain('manifestVersion')
    expect(prompt).toContain('toggle')
    expect(prompt).toContain('choice')
    expect(prompt).toContain('^[a-z][a-z0-9-]*$')
    expect(prompt).toContain('1 to 32')
  })

  it('feeds locked upstream decisions into the prompt', () => {
    const prompt = buildLofiGeneratePrompt({
      project: projectFixture(),
      unit: unitFixture({ dependsOnUnitIds: ['nav-1'] }),
      count: 2,
      outputDir: '/data/scratch/demo-1234/set-3',
      contextFiles: [],
      priorDecisions: [{
        unitLabel: 'Navigation shell',
        summary: 'Locked the left-rail layout.',
        kitSnapshot: { dense: true, theme: 'light' },
        html: '<html><body><nav>Left rail</nav></body></html>',
      }],
    })
    expect(prompt).toContain('Locked decisions this builds on')
    expect(prompt).toContain('Navigation shell')
    expect(prompt).toContain('Locked the left-rail layout.')
    expect(prompt).toContain('dense=true')
    expect(prompt).toContain('theme=light')
    expect(prompt).toContain('<nav>Left rail</nav>')
  })

  it('omits the locked-decisions section when there are none', () => {
    const prompt = buildLofiGeneratePrompt({
      project: projectFixture(),
      unit: unitFixture(),
      count: 2,
      outputDir: '/data/scratch/demo-1234/set-3',
      contextFiles: [],
    })
    expect(prompt).not.toContain('Locked decisions this builds on')
  })

  it('lists the unit references when the reviewer pinned some', () => {
    const prompt = buildLofiGeneratePrompt({
      project: projectFixture(),
      unit: unitFixture(),
      count: 2,
      outputDir: '/data/scratch/demo-1234/set-4',
      contextFiles: [],
      references: [{ label: 'Competitor sign-in', path: '/data/runs/run-4/references/1-competitor-sign-in.png' }],
    })
    expect(prompt).toContain('## References')
    expect(prompt).toContain('Competitor sign-in')
    expect(prompt).toContain('/data/runs/run-4/references/1-competitor-sign-in.png')
  })

  it('feeds the review traces forward as totals', () => {
    const prompt = buildLofiGeneratePrompt({
      project: projectFixture(),
      unit: unitFixture(),
      count: 2,
      outputDir: '/data/scratch/demo-1234/set-5',
      contextFiles: [],
      reviewTraces: [
        { label: 'Option A', reviewed: true, visibleSeconds: 12, kitStatesTried: 3, playedLive: true },
        { label: 'Option B', reviewed: false, visibleSeconds: 0, kitStatesTried: 0, playedLive: false },
      ],
    })
    expect(prompt).toContain('## Review so far')
    expect(prompt).toContain('Option A: reviewed, 12s looked at, 3 kit states tried, played live')
    expect(prompt).toContain('Option B: not reviewed')
  })

  it('omits the review section when there are no traces', () => {
    const prompt = buildLofiGeneratePrompt({
      project: projectFixture(),
      unit: unitFixture(),
      count: 2,
      outputDir: '/data/scratch/demo-1234/set-5',
      contextFiles: [],
    })
    expect(prompt).not.toContain('## Review so far')
  })

  it('omits the references section when there are none', () => {
    const prompt = buildLofiGeneratePrompt({
      project: projectFixture(),
      unit: unitFixture(),
      count: 2,
      outputDir: '/data/scratch/demo-1234/set-4',
      contextFiles: [],
    })
    expect(prompt).not.toContain('## References')
  })

  it('includes project design context when provided', () => {
    const prompt = buildLofiGeneratePrompt({
      project: projectFixture(),
      unit: unitFixture(),
      count: 2,
      outputDir: '/data/scratch/demo-1234/set-2',
      contextFiles: [{ name: 'DESIGN.md', content: 'Primary color is plum.' }],
    })
    expect(prompt).toContain('option-2.kit.json')
    expect(prompt).toContain('Project design context')
    expect(prompt).toContain('Primary color is plum.')
  })
})
