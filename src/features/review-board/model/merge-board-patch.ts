import type { BoardDocument, ReviewAnnotation } from './board-document.schema'
import { isAgentAuthoredAnnotation } from './apply-canvas-event'

export type BoardPatchRecord = {
  kind: 'annotation'
  annotation: ReviewAnnotation
}

export type BoardPatch = {
  documentRevision: number
  records: BoardPatchRecord[]
}

// Upserts agent-authored annotations by id and advances documentRevision.
// Never touches frames, camera, units, verdicts, or human review annotations,
// so a dirty local edit stays intact while agent questions/teach notes land.
export function mergeBoardPatch(document: BoardDocument, patch: BoardPatch): BoardDocument {
  let annotations = document.annotations
  let changed = false

  for (const record of patch.records) {
    if (record.kind !== 'annotation') continue
    if (!isAgentAuthoredAnnotation(record.annotation)) continue

    const index = annotations.findIndex((item) => item.id === record.annotation.id)
    if (index === -1) {
      if (!changed) annotations = [...annotations]
      annotations.push(record.annotation)
      changed = true
      continue
    }

    const current = annotations[index]!
    // Only overwrite an existing agent-authored row. Never clobber a human review
    // annotation that happens to share an id (should not happen, but be safe).
    if (!isAgentAuthoredAnnotation(current)) continue
    if (JSON.stringify(current) === JSON.stringify(record.annotation)) continue
    if (!changed) annotations = [...annotations]
    annotations[index] = record.annotation
    changed = true
  }

  if (!changed && document.documentRevision === patch.documentRevision) return document
  return {
    ...document,
    documentRevision: Math.max(document.documentRevision, patch.documentRevision),
    annotations,
  }
}
