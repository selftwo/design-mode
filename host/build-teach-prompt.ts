import { CANVAS_EVENT_SCHEMA_VERSION } from '../src/features/review-board/model/canvas-event.schema.ts'
import { ANNOTATION_INTENT_GUIDANCE } from '../src/features/review-board/model/annotation-intent.ts'
import type { TeachQuestion } from '../src/features/review-board/model/teach-question.schema.ts'
import type { ContextFile, LearnRequest, Project } from '../src/features/local-host/host-api.schema.ts'

const CONTEXT_FILE_LIMIT = 8_000

type LearnTeachPromptInput = {
  project: Project
  request: LearnRequest
  runId: string
  contextFiles: ContextFile[]
  screenshotPath: string
  canvasEventsPath: string
  createdAt: string
}

type QuestionTeachPromptInput = {
  project: Project
  question: TeachQuestion
  contextFiles: ContextFile[]
}

function appendContextFiles(lines: string[], contextFiles: ContextFile[]) {
  if (contextFiles.length === 0) return
  lines.push('', '## Project design context')
  for (const file of contextFiles) {
    const content = file.content.length > CONTEXT_FILE_LIMIT
      ? `${file.content.slice(0, CONTEXT_FILE_LIMIT)}\n… (truncated)`
      : file.content
    lines.push('', `### ${file.name}`, '', content)
  }
}

function appendSharedVocabulary(lines: string[]) {
  lines.push('', '## Shared vocabulary')
  for (const [intent, guidance] of Object.entries(ANNOTATION_INTENT_GUIDANCE)) {
    lines.push(`- **${intent}**: ${guidance}`)
  }
}

// The learn-lens round trip, reversed from a dispatch: the reviewer asks a
// question about a screen and the agent answers by pinning a teach note. The
// answer explains, it never edits the project or dispatches a change. The agent
// records its answer by appending one teach-answer canvas event to the run's
// append-only log; the host lands it as an anchored teach annotation. The
// requestId is echoed unchanged so the canvas can match the answer to the ask.
function buildLearnTeachPrompt(input: LearnTeachPromptInput): string {
  const { project, request, runId, contextFiles, screenshotPath, canvasEventsPath, createdAt } = input
  const lines: string[] = []
  lines.push('# Teach note request')
  lines.push('')
  lines.push(`A reviewer is looking at a captured screen of the project at \`${project.path}\` and asked a question about it. Answer the question so the reviewer understands the design: what the element is, how it is put together, and the name for it. Explain only. Do not edit the project, generate anything, or dispatch a change.`)
  lines.push('')
  lines.push(`Full-page screenshot of the screen: \`${screenshotPath}\`. The anchor point is normalized 0..1 within that screenshot: [0,0] is the top-left, [1,1] the bottom-right.`)
  lines.push('')
  lines.push('## Question')
  if (request.elementLabel) lines.push(`About element: "${request.elementLabel}"`)
  lines.push(`Anchor: ${JSON.stringify(request.anchor)}`)
  lines.push(`Frame: ${request.frameId}`)
  lines.push('', request.question)

  appendContextFiles(lines, contextFiles)
  appendSharedVocabulary(lines)

  const template = {
    schemaVersion: CANVAS_EVENT_SCHEMA_VERSION,
    id: 'ID',
    runId,
    type: 'teach-answer',
    frameId: request.frameId,
    anchor: request.anchor,
    instruction: 'INSTRUCTION',
    requestId: request.requestId,
    createdAt,
  }

  lines.push('', '## Record your answer')
  lines.push(`Append one line to \`${canvasEventsPath}\` (create the file if it does not exist). The line is this JSON object with INSTRUCTION replaced by your answer and ID replaced by a fresh unique id. Keep every other field exactly as shown, including requestId:`)
  lines.push('')
  lines.push(JSON.stringify(template))
  lines.push('')
  lines.push('Write nothing else to that file. Do not commit. End with a one-line note that you pinned the answer.')
  return lines.join('\n')
}

// Teach prompts share the review prompt's context loading but ask for
// explanation only — no edits, no dispatch, no code changes.
function buildQuestionTeachPrompt(input: QuestionTeachPromptInput): string {
  const { project, question, contextFiles } = input
  const lines: string[] = []
  lines.push('# Design teach question')
  lines.push('')
  lines.push(`You are explaining visual design to a reviewer looking at \`${project.path}\`.`)
  lines.push('Answer the single question below in plain language. Explain only — do not edit files, propose implementation steps, or route work.')
  appendSharedVocabulary(lines)
  appendContextFiles(lines, contextFiles)
  lines.push('', '## Element under review')
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

export function buildTeachPrompt(input: LearnTeachPromptInput): string
export function buildTeachPrompt(input: QuestionTeachPromptInput): string
export function buildTeachPrompt(input: LearnTeachPromptInput | QuestionTeachPromptInput): string {
  return 'request' in input ? buildLearnTeachPrompt(input) : buildQuestionTeachPrompt(input)
}
