import { z } from 'zod'
import type {
  BoardDocument,
  DesignUnit,
  FrameKit,
  KitManifest,
  KitStateValue,
  ScreenFrame,
} from './board-document.schema'

// Cross-record link checks for a board document. The field-level Zod schema
// proves each record is individually well formed; this proves the graph they
// describe is consistent. Every issue is reported at the field that owns the
// bad link, so a validation error points at the record to fix.

type Ctx = z.RefinementCtx

function fail(context: Ctx, path: (string | number)[], message: string): void {
  context.addIssue({ code: z.ZodIssueCode.custom, path, message })
}

// An option frame is one a unit's reviewer can nominate or verdict on: a
// migrated screenshot or a live playable option. Shared with the verdict model.
export function isOptionFrame(frame: ScreenFrame): boolean {
  return frame.kind === 'option-snapshot' || frame.kind === 'playable-option'
}

// Confirms the live `state` for a kit matches its manifest exactly: one key per
// control, correct value types, and choice values drawn from the manifest.
export function checkKitStateAgainstManifest(
  manifest: KitManifest,
  state: Record<string, KitStateValue>,
  context: Ctx,
  path: (string | number)[],
): void {
  const controlIds = new Set(manifest.controls.map((control) => control.id))
  for (const key of Object.keys(state)) {
    if (!controlIds.has(key)) fail(context, [...path, key], `Unknown kit control "${key}"`)
  }
  for (const control of manifest.controls) {
    if (!(control.id in state)) {
      fail(context, path, `Kit state is missing control "${control.id}"`)
      continue
    }
    const value = state[control.id]
    if (control.kind === 'toggle') {
      if (typeof value !== 'boolean') fail(context, [...path, control.id], `Toggle "${control.id}" must be a boolean`)
    } else {
      const allowed = new Set(control.options.map((option) => option.value))
      if (typeof value !== 'string' || !allowed.has(value)) {
        fail(context, [...path, control.id], `Choice "${control.id}" must be one of its option values`)
      }
    }
  }
}

// The full relation check for one frame's kit: the manifest is internally
// consistent (unique control ids, choice defaults drawn from options) and the
// live state matches it exactly. Exported so the host can reuse the same rules
// when it validates a freshly captured kit before writing it to a board, rather
// than keeping a second copy of these checks.
export function addFrameKitRelationIssues(kit: FrameKit, context: Ctx, path: (string | number)[]): void {
  checkManifestInternals(kit.manifest, context, [...path, 'manifest'])
  checkKitStateAgainstManifest(kit.manifest, kit.state, context, [...path, 'state'])
}

function checkManifestInternals(manifest: KitManifest, context: Ctx, path: (string | number)[]): void {
  const seen = new Set<string>()
  manifest.controls.forEach((control, index) => {
    if (seen.has(control.id)) fail(context, [...path, 'controls', index, 'id'], `Duplicate kit control id "${control.id}"`)
    seen.add(control.id)
    if (control.kind === 'choice') {
      const values = new Set<string>()
      control.options.forEach((option, optionIndex) => {
        if (values.has(option.value)) {
          fail(context, [...path, 'controls', index, 'options', optionIndex, 'value'], `Duplicate choice value "${option.value}"`)
        }
        values.add(option.value)
      })
      if (!values.has(control.default)) {
        fail(context, [...path, 'controls', index, 'default'], `Choice default "${control.default}" is not one of its options`)
      }
    }
  })
}

function hasDependencyCycle(units: DesignUnit[]): boolean {
  const byId = new Map(units.map((unit) => [unit.id, unit]))
  const state = new Map<string, 'visiting' | 'done'>()
  const visit = (id: string): boolean => {
    const mark = state.get(id)
    if (mark === 'visiting') return true
    if (mark === 'done') return false
    state.set(id, 'visiting')
    for (const next of byId.get(id)?.dependsOnUnitIds ?? []) {
      if (byId.has(next) && visit(next)) return true
    }
    state.set(id, 'done')
    return false
  }
  return units.some((unit) => visit(unit.id))
}

export function addBoardRelationIssues(document: BoardDocument, context: Ctx): void {
  const frameById = new Map<string, ScreenFrame>()
  document.frames.forEach((frame, index) => {
    if (frameById.has(frame.id)) fail(context, ['frames', index, 'id'], `Duplicate frame id "${frame.id}"`)
    frameById.set(frame.id, frame)
  })

  const annotationIds = new Set<string>()
  document.annotations.forEach((annotation, index) => {
    if (annotationIds.has(annotation.id)) fail(context, ['annotations', index, 'id'], `Duplicate annotation id "${annotation.id}"`)
    annotationIds.add(annotation.id)
    if (!frameById.has(annotation.frameId)) {
      fail(context, ['annotations', index, 'frameId'], `Annotation "${annotation.id}" names missing frame "${annotation.frameId}"`)
    }
  })

  const unitById = new Map<string, DesignUnit>()
  document.units.forEach((unit, index) => {
    if (unitById.has(unit.id)) fail(context, ['units', index, 'id'], `Duplicate unit id "${unit.id}"`)
    unitById.set(unit.id, unit)
  })

  const promoteVerdictByUnit = new Map<string, string>()
  const verdictIds = new Set<string>()
  const verdictByFrame = new Map<string, string>()
  document.verdicts.forEach((verdict, index) => {
    if (verdictIds.has(verdict.id)) fail(context, ['verdicts', index, 'id'], `Duplicate verdict id "${verdict.id}"`)
    verdictIds.add(verdict.id)
    if (verdictByFrame.has(verdict.frameId)) {
      fail(context, ['verdicts', index, 'frameId'], `Frame "${verdict.frameId}" already has a verdict`)
    }
    verdictByFrame.set(verdict.frameId, verdict.id)

    const unit = unitById.get(verdict.unitId)
    if (!unit) {
      fail(context, ['verdicts', index, 'unitId'], `Verdict names missing unit "${verdict.unitId}"`)
    }
    const frame = frameById.get(verdict.frameId)
    if (!frame) {
      fail(context, ['verdicts', index, 'frameId'], `Verdict names missing frame "${verdict.frameId}"`)
    } else {
      if (!isOptionFrame(frame)) fail(context, ['verdicts', index, 'frameId'], 'Verdict must name an option frame')
      if (frame.unitId !== verdict.unitId) fail(context, ['verdicts', index, 'frameId'], 'Verdict frame is in a different unit')
      if (verdict.kind === 'kill' && frame.lifeState !== 'killed') {
        fail(context, ['verdicts', index, 'frameId'], 'A kill verdict must name a killed frame')
      }
    }
    if (verdict.summary.trim().length === 0) {
      fail(context, ['verdicts', index, 'summary'], 'Verdict summary must not be empty')
    }
    if (verdict.kind === 'promote') {
      if (promoteVerdictByUnit.has(verdict.unitId)) {
        fail(context, ['verdicts', index, 'unitId'], `Unit "${verdict.unitId}" already has a promote verdict`)
      }
      promoteVerdictByUnit.set(verdict.unitId, verdict.frameId)
      if (unit && unit.lockedFrameId !== verdict.frameId) {
        fail(context, ['verdicts', index, 'frameId'], "Promote verdict must match its unit's locked frame")
      }
    }
    if (frame) {
      if (frame.kit) {
        if (verdict.kitSnapshot === null) {
          fail(context, ['verdicts', index, 'kitSnapshot'], 'A kit frame verdict must carry a kit snapshot')
        } else {
          checkKitStateAgainstManifest(frame.kit.manifest, verdict.kitSnapshot, context, ['verdicts', index, 'kitSnapshot'])
        }
      } else if (verdict.kitSnapshot !== null) {
        fail(context, ['verdicts', index, 'kitSnapshot'], 'A frame without a kit must have a null kit snapshot')
      }
    }
  })

  document.units.forEach((unit, index) => {
    const seenDeps = new Set<string>()
    unit.dependsOnUnitIds.forEach((depId, depIndex) => {
      if (depId === unit.id) fail(context, ['units', index, 'dependsOnUnitIds', depIndex], 'A unit cannot depend on itself')
      if (seenDeps.has(depId)) fail(context, ['units', index, 'dependsOnUnitIds', depIndex], `Duplicate dependency "${depId}"`)
      seenDeps.add(depId)
      if (!unitById.has(depId)) fail(context, ['units', index, 'dependsOnUnitIds', depIndex], `Dependency names missing unit "${depId}"`)
    })

    if (unit.nomineeFrameId) {
      const nominee = frameById.get(unit.nomineeFrameId)
      if (!nominee || nominee.unitId !== unit.id || !isOptionFrame(nominee) || nominee.lifeState !== 'active') {
        fail(context, ['units', index, 'nomineeFrameId'], 'Nominee must be an active option frame in this unit')
      }
    }

    if (unit.state === 'open') {
      if (unit.lockedFrameId) fail(context, ['units', index, 'lockedFrameId'], 'An open unit cannot have a locked frame')
      if (promoteVerdictByUnit.has(unit.id)) fail(context, ['units', index, 'state'], 'An open unit cannot have a promote verdict')
    } else {
      if (!unit.lockedFrameId) {
        fail(context, ['units', index, 'lockedFrameId'], 'A locked unit must have a locked frame')
      } else {
        const winner = frameById.get(unit.lockedFrameId)
        if (!winner || winner.unitId !== unit.id) {
          fail(context, ['units', index, 'lockedFrameId'], 'Locked frame must be an option in this unit')
        } else if (winner.lifeState !== 'locked') {
          fail(context, ['units', index, 'lockedFrameId'], 'Locked frame must have lifeState "locked"')
        }
        if (!promoteVerdictByUnit.has(unit.id)) {
          fail(context, ['units', index, 'state'], 'A locked unit must have a promote verdict')
        }
      }
    }
  })

  if (hasDependencyCycle(document.units)) {
    fail(context, ['units'], 'Unit dependency graph must not contain a cycle')
  }

  // One review summary per frame at most. Orphaned summaries (frame since
  // deleted) are tolerated so a delete never has to rewrite the traces.
  const summaryFrameIds = new Set<string>()
  document.reviewSummaries.forEach((summary, index) => {
    if (summaryFrameIds.has(summary.frameId)) {
      fail(context, ['reviewSummaries', index, 'frameId'], `Frame "${summary.frameId}" already has a review summary`)
    }
    summaryFrameIds.add(summary.frameId)
  })

  const zoneById = new Map<string, { unitId: string; kind: 'archive' | 'killed' }>()
  const unitZoneKinds = new Map<string, Set<string>>()
  document.zones.forEach((zone, index) => {
    if (zoneById.has(zone.id)) fail(context, ['zones', index, 'id'], `Duplicate zone id "${zone.id}"`)
    zoneById.set(zone.id, { unitId: zone.unitId, kind: zone.kind })
    if (!unitById.has(zone.unitId)) fail(context, ['zones', index, 'unitId'], `Zone names missing unit "${zone.unitId}"`)
    const kinds = unitZoneKinds.get(zone.unitId) ?? new Set<string>()
    if (kinds.has(zone.kind)) fail(context, ['zones', index, 'kind'], `Unit "${zone.unitId}" already has a ${zone.kind} zone`)
    kinds.add(zone.kind)
    unitZoneKinds.set(zone.unitId, kinds)
  })

  const lockedFrameByUnit = new Map<string, string>()
  document.units.forEach((unit) => {
    if (unit.lockedFrameId) lockedFrameByUnit.set(unit.id, unit.lockedFrameId)
  })

  document.frames.forEach((frame, index) => {
    if (frame.kind === 'playable-option') {
      if (!frame.unitId) fail(context, ['frames', index, 'unitId'], 'A playable option must belong to a unit')
      if (!frame.liveSource) fail(context, ['frames', index, 'liveSource'], 'A playable option must have a live source')
      if (!frame.kit) fail(context, ['frames', index, 'kit'], 'A playable option must have a kit')
    } else {
      if (frame.liveSource) fail(context, ['frames', index, 'liveSource'], `A ${frame.kind} frame cannot have a live source`)
      if (frame.kit) fail(context, ['frames', index, 'kit'], `A ${frame.kind} frame cannot have a kit`)
    }
    if (frame.kind === 'option-snapshot' && !frame.unitId) {
      fail(context, ['frames', index, 'unitId'], 'An option snapshot must belong to a unit')
    }

    if (frame.kit) {
      addFrameKitRelationIssues(frame.kit, context, ['frames', index, 'kit'])
    }

    if (frame.unitId && !unitById.has(frame.unitId)) {
      fail(context, ['frames', index, 'unitId'], `Frame names missing unit "${frame.unitId}"`)
    }
    if (!frame.unitId && frame.zoneId) {
      fail(context, ['frames', index, 'zoneId'], 'A frame without a unit cannot sit in a zone')
    }

    // Only option frames move through the lifecycle. Captured routes, uploads,
    // and pinned references never lock, archive, or die.
    if (!isOptionFrame(frame) && frame.lifeState !== 'active') {
      fail(context, ['frames', index, 'lifeState'], `A ${frame.kind} frame must stay active`)
    }

    if (frame.lifeState === 'active' || frame.lifeState === 'locked') {
      if (frame.zoneId) fail(context, ['frames', index, 'zoneId'], 'Active and locked frames cannot sit in a zone')
    }
    if ((frame.lifeState === 'archived' || frame.lifeState === 'killed') && frame.unitId && !frame.zoneId) {
      fail(context, ['frames', index, 'zoneId'], 'An archived or killed frame must sit in a zone')
    }
    if (frame.lifeState === 'locked') {
      if (!frame.unitId || lockedFrameByUnit.get(frame.unitId) !== frame.id) {
        fail(context, ['frames', index, 'lifeState'], "A locked frame must match its unit's locked frame")
      }
    }
    if (frame.lifeState === 'killed' && verdictByFrame.get(frame.id) === undefined) {
      fail(context, ['frames', index, 'lifeState'], 'A killed frame must have a matching kill verdict')
    }

    if (frame.zoneId) {
      const zone = zoneById.get(frame.zoneId)
      if (!zone) {
        fail(context, ['frames', index, 'zoneId'], `Frame names missing zone "${frame.zoneId}"`)
      } else {
        if (frame.unitId && zone.unitId !== frame.unitId) {
          fail(context, ['frames', index, 'zoneId'], 'A frame zone must belong to the same unit')
        }
        if (frame.lifeState === 'archived' && zone.kind !== 'archive') {
          fail(context, ['frames', index, 'zoneId'], 'An archived frame can only sit in an archive zone')
        }
        if (frame.lifeState === 'killed' && zone.kind !== 'killed') {
          fail(context, ['frames', index, 'zoneId'], 'A killed frame can only sit in a killed zone')
        }
      }
    }
  })
}
