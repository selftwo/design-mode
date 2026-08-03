import type { FrameElement, ScreenFrame, TeachAnnotation } from './model/board-document.schema'

export function buildTeachAnnotation(input: {
  frame: ScreenFrame
  element: FrameElement
  question: string
  answer: string
  provenanceRunId: string
}): TeachAnnotation {
  const [start, end] = input.element.bounds
  return {
    kind: 'teach',
    id: crypto.randomUUID(),
    frameId: input.frame.id,
    status: 'draft',
    instruction: input.answer,
    question: input.question,
    provenanceRunId: input.provenanceRunId,
    anchor: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
    mark: {
      kind: 'element',
      elementId: input.element.id,
      label: input.element.label,
      points: input.element.bounds,
    },
    createdAt: new Date().toISOString(),
    madeAgainstCaptureHash: input.frame.captureHash,
    madeAgainstRevision: input.frame.revision,
  }
}
