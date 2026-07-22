import { CANVAS_EVENT_SCHEMA_VERSION } from '../src/features/review-board/model/canvas-event.schema.ts'
import type { ContextFile, LearnRequest, Project } from '../src/features/local-host/host-api.schema.ts'

const CONTEXT_FILE_LIMIT = 8_000

// The learn-lens round trip, reversed from a dispatch: the reviewer asks a
// question about a screen and the agent answers by pinning a teach note. The
// answer explains, it never edits the project or dispatches a change. The agent
// records its answer by appending one teach-answer canvas event to the run's
// append-only log; the host lands it as an anchored teach annotation. The
// requestId is echoed unchanged so the canvas can match the answer to the ask.
export function buildTeachPrompt({
  project,
  request,
  runId,
  contextFiles,
  screenshotPath,
  canvasEventsPath,
  createdAt,
}: {
  project: Project
  request: LearnRequest
  runId: string
  contextFiles: ContextFile[]
  screenshotPath: string
  canvasEventsPath: string
  createdAt: string
}): string {
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

  if (contextFiles.length > 0) {
    lines.push('', '## Project design context')
    for (const file of contextFiles) {
      const content = file.content.length > CONTEXT_FILE_LIMIT
        ? `${file.content.slice(0, CONTEXT_FILE_LIMIT)}\n… (truncated)`
        : file.content
      lines.push('', `### ${file.name}`, '', content)
    }
  }

  // The machine-readable answer contract. The agent appends exactly one JSON
  // object as a single line, replacing only INSTRUCTION with its answer and ID
  // with a fresh unique id. Every other field is fixed so the host can validate
  // the event and match it to this question.
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
