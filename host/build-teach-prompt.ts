import { ANNOTATION_INTENT_GUIDANCE } from '../src/features/review-board/model/annotation-intent.ts'
import type { TeachQuestion } from '../src/features/review-board/model/teach-question.schema.ts'
import type { ContextFile, Project } from '../src/features/local-host/host-api.schema.ts'

const CONTEXT_FILE_LIMIT = 8_000

// Teach prompts share the review prompt's context loading but ask for
// explanation only — no edits, no dispatch, no code changes.
export function buildTeachPrompt({
  project,
  question,
  contextFiles,
}: {
  project: Project
  question: TeachQuestion
  contextFiles: ContextFile[]
}): string {
  const lines: string[] = []
  lines.push('# Design teach question')
  lines.push('')
  lines.push(`You are explaining visual design to a reviewer looking at \`${project.path}\`.`)
  lines.push('Answer the single question below in plain language. Explain only — do not edit files, propose implementation steps, or route work.')
  lines.push('')
  lines.push('## Shared vocabulary')
  for (const [intent, guidance] of Object.entries(ANNOTATION_INTENT_GUIDANCE)) {
    lines.push(`- **${intent}**: ${guidance}`)
  }
  lines.push('')
  if (contextFiles.length > 0) {
    lines.push('## Project design context')
    for (const file of contextFiles) {
      const content = file.content.length > CONTEXT_FILE_LIMIT
        ? `${file.content.slice(0, CONTEXT_FILE_LIMIT)}\n… (truncated)`
        : file.content
      lines.push('', `### ${file.name}`, '', content)
    }
    lines.push('')
  }
  lines.push('## Element under review')
  lines.push(`Frame: ${question.frameId} (route ${question.route}, viewport ${question.viewport.width}x${question.viewport.height})`)
  lines.push(`Element: "${question.element.label}" (${question.element.role}, bounds ${JSON.stringify(question.element.bounds)})`)
  lines.push('', '### Anatomy', '', '```', question.anatomy, '```')
  lines.push('', `Vocabulary term: **${question.vocabularyTerm}**`)
  lines.push(question.whyLine)
  lines.push('', '## Question', '', question.question)
  lines.push('', '## Response rules')
  lines.push('- One short paragraph, two at most.')
  lines.push('- Name what the reviewer is seeing and why it works or reads the way it does.')
  lines.push('- No bullet lists of tasks, no code fences, no "I will" or "you should implement".')
  return lines.join('\n')
}
