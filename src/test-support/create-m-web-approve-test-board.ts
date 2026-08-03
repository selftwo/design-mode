import type { AgentRun } from '@/features/local-host/host-api.schema'
import { createMWebTestBoard } from './create-m-web-test-board'
import type { BoardDocument } from '@/features/review-board/model/board-document.schema'

export function createMWebApproveTestBoard(): BoardDocument {
  return createMWebTestBoard()
}

export function createMWebApproveTestRun(annotationId: string): AgentRun {
  return {
    id: 'run-approve-142',
    projectId: 'smalltools',
    agent: 'codex',
    status: 'done',
    annotationIds: [annotationId],
    outputTail: 'Proposed: measure capped at 60ch, cards move up 32px. Patch staged.',
    startedAt: '2026-07-17T11:59:00.000Z',
    finishedAt: '2026-07-17T12:00:00.000Z',
  }
}

export function createMWebTeachApproveTestBoard(): BoardDocument {
  const board = createMWebTestBoard()
  const frame = board.frames[0]!
  return {
    ...board,
    annotations: [
      ...board.annotations,
      {
        kind: 'teach',
        id: 'teach-hero',
        frameId: frame.id,
        status: 'draft',
        instruction: 'Measure is the length of a text line. Long measures tire the eye.',
        question: 'What is measure?',
        provenanceRunId: 'run-teach-141',
        anchor: [0.5, 0.3],
        mark: {
          kind: 'element',
          elementId: 'hero',
          label: 'hero',
          points: [[0.2, 0.15], [0.8, 0.45]],
        },
        createdAt: '2026-07-17T11:55:00.000Z',
        madeAgainstCaptureHash: frame.captureHash,
        madeAgainstRevision: frame.revision,
      },
    ],
  }
}
