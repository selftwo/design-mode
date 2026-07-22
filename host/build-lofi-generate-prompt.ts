import type { ContextFile, Project } from '../src/features/local-host/host-api.schema.ts'
import type { DesignUnit, KitStateValue } from '../src/features/review-board/model/board-document.schema.ts'
import { PLAYABLE_BRIDGE_HOOK } from './playable-option-bridge.ts'

const CONTEXT_FILE_LIMIT = 8_000

// A locked upstream decision this run must stay consistent with: the winning
// option of a dependency unit, its confirmed ledger line, the kit state it was
// locked at, and its self-contained HTML.
export interface PriorDecision {
  unitLabel: string
  summary: string
  kitSnapshot: Record<string, KitStateValue> | null
  html: string
}

// The instruction for a "generate lo-fi options" run. The agent writes several
// standalone HTML files the host will later capture into option frames, so a
// reviewer can compare directions on the canvas and pick one to build for real.
// The design direction comes from the unit's brief and rules, never from client
// prompt text, so the reviewer controls the request through the board.
// A reference the reviewer pinned to this unit, copied into the run so the agent
// can open it: the reviewer's own research for the decision.
export interface GenerationReference {
  label: string
  path: string
}

// A per-option review trace fed forward so the agent knows what was actually
// looked at. Totals only (rounded seconds, kit-state count), never raw timings.
export interface GenerationReviewTrace {
  label: string
  reviewed: boolean
  visibleSeconds: number
  kitStatesTried: number
  playedLive: boolean
}

export function buildLofiGeneratePrompt({
  project,
  unit,
  count,
  outputDir,
  contextFiles,
  priorDecisions = [],
  references = [],
  reviewTraces = [],
}: {
  project: Project
  unit: DesignUnit
  count: number
  outputDir: string
  contextFiles: ContextFile[]
  priorDecisions?: PriorDecision[]
  references?: GenerationReference[]
  reviewTraces?: GenerationReviewTrace[]
}): string {
  const lines: string[] = []
  lines.push('# Generate lo-fi design options')
  lines.push('')
  lines.push(`Produce ${count} distinct low-fidelity design options for the design unit below, so a reviewer can compare them side by side on a canvas and pick one to build for real in \`${project.path}\`.`)
  lines.push('')
  lines.push('## Design unit')
  lines.push(`Label: ${unit.label}`)
  lines.push('')
  lines.push('Brief:')
  lines.push(unit.brief)
  lines.push('')
  lines.push('Rules:')
  if (unit.rules.length === 0) {
    lines.push('No extra rules.')
  } else {
    for (const rule of unit.rules) lines.push(`- ${rule}`)
  }
  lines.push('')

  if (references.length > 0) {
    lines.push('## References')
    lines.push('The reviewer pinned these reference images to this unit. Open them for direction; treat them as research, not as layouts to copy exactly.')
    for (const reference of references) {
      lines.push(`- ${reference.label}: \`${reference.path}\``)
    }
    lines.push('')
  }

  if (reviewTraces.length > 0) {
    lines.push('## Review so far')
    lines.push('How the reviewer explored the current options. Lean away from directions already reviewed and set aside; a not-reviewed option may just have been missed.')
    for (const trace of reviewTraces) {
      const bits = [trace.reviewed ? 'reviewed' : 'not reviewed', `${trace.visibleSeconds}s looked at`, `${trace.kitStatesTried} kit states tried`]
      if (trace.playedLive) bits.push('played live')
      lines.push(`- ${trace.label}: ${bits.join(', ')}`)
    }
    lines.push('')
  }

  if (priorDecisions.length > 0) {
    lines.push('## Locked decisions this builds on')
    lines.push('These upstream units are already decided. Keep your options consistent with the winners below; do not redesign them.')
    for (const decision of priorDecisions) {
      lines.push('', `### ${decision.unitLabel}`)
      if (decision.summary) lines.push(`Verdict: ${decision.summary}`)
      if (decision.kitSnapshot && Object.keys(decision.kitSnapshot).length > 0) {
        const kit = Object.entries(decision.kitSnapshot).map(([id, value]) => `${id}=${String(value)}`).join(', ')
        lines.push(`Locked kit state: ${kit}`)
      }
      if (decision.html.trim()) {
        const html = decision.html.length > CONTEXT_FILE_LIMIT
          ? `${decision.html.slice(0, CONTEXT_FILE_LIMIT)}\n<!-- truncated -->`
          : decision.html
        lines.push('Winning HTML:', '', '```html', html, '```')
      }
    }
    lines.push('')
  }

  lines.push('## Output')
  lines.push(`Write your files into this directory only:`)
  lines.push(`\`${outputDir}\``)
  lines.push('')
  lines.push(`Write exactly ${count} option${count === 1 ? '' : 's'}. Each option is a pair of files: an HTML file and a matching control manifest. Write these files, and only these files (no notes, no extra options, no assets):`)
  for (let index = 1; index <= count; index += 1) {
    lines.push(`- \`option-${index}.html\` and \`option-${index}.kit.json\``)
  }
  lines.push('')
  lines.push('### Each `option-N.html` must')
  lines.push('- Be a complete, self-contained HTML document with inline styles only. No external CSS, images, or fonts.')
  lines.push('- Contain no `<script>` of your own. The review host injects the one script the frame needs. Any script you write will be rejected.')
  lines.push(`- Include this exact tag in the \`<head>\` so the host knows the file is a playable option: \`${PLAYABLE_BRIDGE_HOOK}\``)
  lines.push('- Stay low fidelity: wireframe-level layout and hierarchy, neutral greys, system fonts. This is for comparing directions, not final visuals.')
  lines.push('- Explore a genuinely different layout or structure from the other options, not just a recolor.')
  lines.push('- Render on its own when opened directly in a browser at a typical desktop width.')
  lines.push('')
  lines.push('### Each `option-N.kit.json` must')
  lines.push('Be a JSON object describing the controls a reviewer can toggle on this option, shaped exactly like this:')
  lines.push('')
  lines.push('```json')
  lines.push('{')
  lines.push('  "manifestVersion": 1,')
  lines.push('  "controls": [')
  lines.push('    { "kind": "toggle", "id": "dense", "label": "Dense layout", "default": false },')
  lines.push('    { "kind": "choice", "id": "theme", "label": "Theme",')
  lines.push('      "options": [ { "value": "light", "label": "Light" }, { "value": "dark", "label": "Dark" } ],')
  lines.push('      "default": "light" }')
  lines.push('  ]')
  lines.push('}')
  lines.push('```')
  lines.push('')
  lines.push('Rules for the manifest:')
  lines.push('- `manifestVersion` is `1`.')
  lines.push('- `controls` holds 1 to 32 controls. Each control is either a `toggle` or a `choice`.')
  lines.push('- Every control `id` is unique within the file, lowercase, and matches `^[a-z][a-z0-9-]*$` (start with a letter; letters, digits, and hyphens only).')
  lines.push('- Every `label` is 1 to 120 characters.')
  lines.push('- A `toggle` has a boolean `default`.')
  lines.push('- A `choice` has 1 to 32 `options`, each with a `value` (same `^[a-z][a-z0-9-]*$` rule, unique within the control) and a `label`. Its `default` must be one of those option values.')
  lines.push('- Do not include any current state or selected value; the host derives the starting state from the defaults.')
  lines.push('- Name each control after something the reviewer could actually vary in this option (density, emphasis, order, tone). The kit is how they play the option, so make the controls real.')
  lines.push('')
  lines.push('Do not edit the project source or commit. Only write the option files and their kit manifests.')

  if (contextFiles.length > 0) {
    lines.push('', '## Project design context (optional reference)')
    for (const file of contextFiles) {
      const content = file.content.length > CONTEXT_FILE_LIMIT
        ? `${file.content.slice(0, CONTEXT_FILE_LIMIT)}\n… (truncated)`
        : file.content
      lines.push('', `### ${file.name}`, '', content)
    }
  }
  return lines.join('\n')
}
