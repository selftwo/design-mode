import type { AgentRun } from '@/features/local-host/host-api.schema'
import { isInstructionIncomplete } from '@/features/review-board/model/annotation-instruction'
import { isAnnotationStale } from '@/features/review-board/model/is-annotation-stale'
import type { BoardDocument } from '@/features/review-board/model/board-document.schema'
import { isReviewAnnotation } from '@/features/review-board/is-board-annotation'
import { formatRelativeTime } from './format-relative-time'

export type BoardListEntry = {
  projectId: string
  title: string
  ageLabel: string
  thumbUrls: string[]
  openThreadCount: number
  latestRun: AgentRun | null
}

function openThreadCount(board: BoardDocument): number {
  return board.annotations.filter((annotation) => {
    if (!isReviewAnnotation(annotation)) return false
    const frame = board.frames.find((item) => item.id === annotation.frameId)
    if (!frame) return false
    if (isAnnotationStale(annotation, frame)) return false
    return !isInstructionIncomplete(annotation.instruction)
  }).length
}

function latestRunForProject(runs: AgentRun[], projectId: string): AgentRun | null {
  return runs.find((run) => run.projectId === projectId) ?? null
}

export function buildBoardListEntry(
  projectId: string,
  projectName: string,
  board: BoardDocument | null,
  runs: AgentRun[],
): BoardListEntry {
  const latestRun = latestRunForProject(runs, projectId)
  const updatedAt = latestRun?.finishedAt ?? latestRun?.startedAt ?? board?.annotations[0]?.createdAt
  return {
    projectId,
    title: board?.boardId ?? projectName,
    ageLabel: updatedAt ? formatRelativeTime(updatedAt) : '—',
    thumbUrls: board?.frames.slice(0, 3).map((frame) => frame.screenshotDataUrl) ?? [],
    openThreadCount: board ? openThreadCount(board) : 0,
    latestRun,
  }
}
