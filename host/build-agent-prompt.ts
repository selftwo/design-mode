import { ANNOTATION_INTENT_GUIDANCE } from '../src/features/review-board/model/annotation-intent.ts'
import type { ReviewBatch } from '../src/features/review-board/model/review-batch.ts'
import type { ContextFile, Project } from '../src/features/local-host/host-api.schema.ts'

const CONTEXT_FILE_LIMIT = 8_000

function describeMark(mark: ReviewBatch['annotations'][number]['marks'][number]): string {
  if (mark.kind === 'element') return `picked element "${mark.label}" (bounds ${JSON.stringify(mark.points)})`
  if (mark.kind === 'circle') return `circled region ${JSON.stringify(mark.points)}`
  return `freehand ink over ${JSON.stringify([mark.points[0], mark.points[mark.points.length - 1]])} (${mark.points.length} points)`
}

// One prompt for every agent adapter. It carries the review batch, the
// project's own design context files, and the shared intent vocabulary, so
// Claude Code, Codex, and Cursor all act on identical information.
export function buildAgentPrompt({
  project,
  batch,
  contextFiles,
  screenshotDirectory,
}: {
  project: Project
  batch: ReviewBatch
  contextFiles: ContextFile[]
  screenshotDirectory: string
}): string {
  const lines: string[] = []
  lines.push('# Design review batch')
  lines.push('')
  lines.push(`You are applying visual design feedback to the project at \`${project.path}\`.`)
  lines.push('A reviewer marked exact regions on captured screens. Apply every item below by editing the project source. Follow the project\'s own conventions and design context. Do not commit.')
  lines.push('')
  lines.push(`Full-page screenshots of each annotated screen are in \`${screenshotDirectory}\` named by frame id. Mark coordinates are normalized 0..1 within the frame: [0,0] is the top-left of the screenshot, [1,1] the bottom-right.`)
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

  lines.push('## Review items')
  batch.annotations.forEach((annotation, index) => {
    lines.push('', `### ${index + 1}. ${annotation.frameId} (route ${annotation.route}, viewport ${annotation.viewport.width}x${annotation.viewport.height})`)
    lines.push(`Screenshot: ${screenshotDirectory}/${annotation.frameId}.png`)
    lines.push(`Anchor: ${JSON.stringify(annotation.anchor)}`)
    for (const mark of annotation.marks) lines.push(`Mark: ${describeMark(mark)}`)
    for (const element of annotation.elements) {
      lines.push(`Target element: "${element.label}" (bounds ${JSON.stringify(element.bounds)})`)
    }
    if (annotation.intent) {
      lines.push(`Design intent: ${annotation.intent} — ${ANNOTATION_INTENT_GUIDANCE[annotation.intent]}`)
    }
    lines.push(`Instruction: ${annotation.instruction}`)
  })

  lines.push('', '## Ground rules')
  lines.push('- Change only what the review items call for.')
  lines.push('- Keep the project building; run its checks if it has any.')
  lines.push('- If the project has Impeccable installed (an `.impeccable/` directory or impeccable skills), use its critique and command vocabulary when it helps.')
  lines.push('- End with a short summary of what changed, one line per review item.')
  return lines.join('\n')
}
