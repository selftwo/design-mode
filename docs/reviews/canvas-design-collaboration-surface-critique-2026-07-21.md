---
title: Critique — Canvas design collaboration surface plan
status: review
date: 2026-07-21
reviews: docs/plans/canvas-design-collaboration-surface-2026-07-21.md
---

## Scope

One-page critique of the plan. Goal is a tighter plan, not a longer one. I spot-checked
`board-document.schema.ts:18-118` (no `kind`/`lifeState`/`kit`/`documentRevision` fields today)
and confirmed the trusted context about the live iframe, the image/live switch, and whole-doc save.

## 1. Top 3 under-specified seams that block a builder starting item 1

1. **The kit manifest has no schema.** Item 1(b) makes each `option-N.kit.json` (toggle/choice
   controls) a hard requirement, and 1(a) adds a per-frame `kit` field, but neither the manifest
   shape nor the stored kit-state shape is defined anywhere. A builder cannot write the generate
   prompt, the capture reader, or `FrameKitIsland` without it. This is the single biggest blocker.
2. **The iframe bridge protocol is named but not specced.** Item 1(b/d) adds
   `host/playable-option-bridge.ts` and `use-playable-option-connection.ts` with "token/source/port/
   sequence checks," but no message schema. The repo already has the exact pattern to copy
   (`live-review-message.schema.ts`, `build-live-review-hello-message.ts`); the plan should point at
   it and say "same handshake, new channel," or the builder reinvents it.
3. **Play/review pointer ownership over the live frame is hand-waved.** Item 1(d) says the shared
   media surface gives pointer input to the iframe in play mode and "takes it back" in review mode,
   and that this fixes the dropped-marks gap at `ScreenFrameNode.tsx:317-333`. But it does not say how
   that reconciles with React Flow's `nodrag/nopan/nowheel` zones and the existing focused-frame
   branch. This is the highest-risk piece of item 1 and needs a concrete pointer/mode contract.

Also undefined but lower: the `liveSource` locator shape used to serve scratch HTML.

## 2. Contradictions and ordering problems in the work items

- **Item 2 archives siblings into zones that item 3 builds.** Item 2 says promote "archives siblings
  into a greyed zone" and kill "moves one frame," but the zone model, geometry, and `BoardZoneNode`
  all arrive in item 3 (`board-zone-geometry.ts`, `move-frame-to-zone.ts`). Item 2 can set
  `lifeState`, but "into a greyed zone" depends on item 3. Either reorder zones before verdict
  archiving, or scope item 2 to set `lifeState` only and let item 3 own placement. Say which.
- **Item 2's immediate save predates the save contract it needs.** Item 2 makes verdict confirmation
  "save immediately, not on the 600ms debounce" against today's whole-doc overwrite
  (`local-host-client.ts:169-177`). The compare-and-save contract lands in item 4(a). This is safe
  only because no agent writer exists yet, but item 2 builds a save path that item 4(a) then reworks.
  Flag it so the builder does not harden the wrong path twice.
- **The revisioned-save prerequisite is ordered correctly.** The Approach calls it a "hard
  prerequisite for work item 4," and it is item 4(a), the first sub-item of 4. No fix needed; the
  framing just reads as if it were a global prerequisite.
- **Schema is consumed far from where it lands.** `documentRevision` (item 1) is first read in item 4;
  `reviewSummaries` (item 1) is first read in item 6. See section 3.

## 3. Over-planning: what to cut, merge, or defer

The true thin end-to-end slice is items 1 to 2: one unit, live playable options with a kit, a verdict
that locks and feeds the next prompt. Everything below should come out of the first pass.

- **Defer item 6 (review telemetry) entirely.** Dwell accounting, visibility ratios, kit-state
  counts, and prompt injection are a lot of schema and plumbing for a signal nothing yet needs. Drop
  `reviewSummaries` from the v2 bump until item 6 is actually scheduled.
- **Defer `documentRevision` out of the item 1 bump into item 4(a).** It has no reader before the
  save contract exists. Adding it early only enlarges the migration.
- **Defer item 5 (first-class references).** The live-playable + verdict loop proves out without
  reference pinning; references are additive and can follow.
- **Trim the v2 bump to what items 1 to 3 read:** `kind`, `lifeState`, `unitId`, `zoneId`,
  `liveSource`, `kit`, plus `units`, `zones`, `verdicts`. This keeps the "one bump, done first"
  discipline while cutting two fields with no near-term consumer.
- **Delete the duplicated open question.** "Kit manifest ownership" appears twice (plan lines 99 and
  100) with the same content.

## 4. Questions whose answers change implementation order

- **Kit manifest ownership (external dial island vs in-frame strip only).** Listed as open, but item 1
  is the first thing built and cannot proceed without it: it sets the postMessage scope and whether
  `FrameKitIsland` exists in 1(d). Must be answered before item 1(b), not "before item 2."
- **Units as first-class object vs labelled group.** The plan gives a recommended default but marks it
  "confirm or override." It decides how much schema item 1(a) adds, so it gates item 1, not item 2.
  Lock it before starting.

Net: two of the "open" questions actually gate item 1, which contradicts the plan's claim that only
items 2 and 3 carry deferred decisions. Answer both, cut items 5 and 6 and two schema fields from the
first pass, and resolve the item 2 vs item 3 zone-ownership order before a builder starts.
