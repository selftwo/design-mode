---
title: Canvas as a bespoke agent-human design collaboration surface
status: draft
date: 2026-07-21
---

## Goal

Turn the review canvas into the one place where Ben and a design agent collaborate on lo-fi structure: many **live, playable** prototypes side by side, each with its own control kit ("dial") the reviewer can toggle, references pinned as first-class research, verdicts made by gesture into a ledger, and killed or archived variants dragged into greyed-out zones. This is the canvas version of the localhost lo-fi run documented in the handoff (`.context/attachments/Mi4BTL/...`): same unit-queue-verdict-feedforward loop, but the review surface, the reference material, and the verdict channel become one persistent visible place. It supersedes the screenshot-only assumption of `canvas-lofi-option-studio-2026-07-21.md`.

## Background

### What the handoff asks for (the target)

From the localhost run, carried onto the canvas:
- **Live prototypes, not pictures** — kit/dial toggles must stay playable on the canvas (embedded iframes, not screenshots of them). This is the load-bearing requirement.
- Units as the grain of decision; a visible queue; no unit opens until its dependencies lock.
- One-line verdicts into a ledger; lock-by-promotion; killed variants shrink into a collapsed shelf ("what lost", visually present, greyed out).
- References enter by drop, stay permanently next to the unit they rule, verdict links to them.
- The agent works on the same surface: new variants appear when built; agent questions attach to frames; a learning channel explains elements.
- Exploration leaves traces: which kit states were viewed, enough signal for the agent to know what was reviewed vs skipped.

### The decision to revisit

The current lo-fi plan renders each option as a static Playwright screenshot and states "only the rendered outputs live on the canvas for comparison" and "No live style editing on the canvas" (`canvas-lofi-option-studio-2026-07-21.md:33`). Playable is not the same as editable: we keep generation in the agent (no on-canvas CSS editing), but the frame becomes a **live iframe** the reviewer can interact with. Screenshots stay, demoted to a cheap thumbnail for offscreen/archived frames.

This direction is already anticipated in the codebase, not against it:
- React Flow was chosen partly for "an in place live iframe" (`DECISIONS.md:21`).
- `LiveReviewFrame.tsx:5-40` already renders an interactive iframe (`nodrag/nopan/nowheel`) from a live-session config.
- `ScreenFrameNode.tsx:317-333` already switches the focused frame between `LiveReviewFrame` and the static `<img>` surface.
- Specs lock "Live mode renders the target page inside the selected React Flow screen node" (`specs/react-flow-review-canvas.md:92`) and a host-injected handshake script for live view (`specs/design-mode-host.md:38`).
- The agent-collaboration/learning layer is already specced as the pivot "island chrome": runs island, bloom threads, **learn lens** and **teach annotations** (agent-voiced annotations, a reversed review batch) — `.scratch/designmode-pivot/spec.md`, `specs/learn-lens-teach-annotations.md`. None of it is built on this branch.

### Current build seams (what to extend)

| Concern | File:line | Note |
| --- | --- | --- |
| Frame schema | `src/features/review-board/model/board-document.schema.ts:18-56` | `source` (`captured-route`/`lofi-option`), `optionSetId`, `preferred`; no frame-kind, status, group, or archive field |
| Board doc | `board-document.schema.ts:112-118` | only `camera`, `frames`, `annotations`; no groups/zones/ledger |
| Node render + image/live switch | `ScreenFrameNode.tsx:317-340` | focused → live iframe, else `<img>`; marks branch replaced under live |
| Live iframe (exists) | `src/features/live-review/LiveReviewFrame.tsx:5-40` | interactive iframe from `config.liveUrl`, session-scoped not per-frame |
| Marks (normalized 0..1) | `board-geometry.ts:3-14`, `ScreenFrameNode.tsx:70-210` | SVG `viewBox 0 0 1 1`; do **not** render over the live iframe |
| Lo-fi capture + serve | `host/capture-lofi-options.ts:21-58`, `host/design-mode-host.ts:310-330` | screenshots `option-*.html`; host already serves `/scratch/<project>/<set>/<file>` (browsable, path-guarded) |
| Merge/layout | `host/merge-captured-frames.ts:3-56` | new set appended contiguously; preserves position/preferred; only sibling link is `optionSetId` |
| Generate loop | `host/design-mode-host.ts:220-286`, `build-lofi-generate-prompt.ts` | agent writes self-contained HTML into scratch; recapture-on-clean-exit |
| Agent dispatch + SSE + runs | `host/design-mode-host.ts:162-217`, `host-event-bus.ts`, `local-host-client.ts:248-255` | one-way: dispatch out, capture frames back; run journal `~/.design-mode/runs/<id>/`; no agent→canvas message channel |
| Persistence/autosave | `App.tsx:145-151`, `local-host-client.ts:169-177` | 600ms debounce, whole-doc `PUT`, schema-validated both ends |

## Approach

### The loop

One unit at a time: reviewer writes a unit brief and rules, asks the agent for N options, the agent writes self-contained HTML plus a control manifest per option, the host captures and lands them as **playable** frames grouped under the unit, the reviewer plays each option's kit and marks it up, then stamps one to lock or strikes one to kill. The confirmed verdict writes one ledger line, locks the unit, archives the losing siblings into a greyed zone, and unblocks any dependent unit. The next generation prompt carries the confirmed verdicts, the winning HTML, its locked kit state, and the linked references. This is the handoff loop, made spatial.

### Live-first frames, screenshot as the cheap shell

A lo-fi option becomes a live `<iframe>` the reviewer can interact with, not a screenshot. The screenshot does not go away: it is the low-cost shell shown for offscreen, archived, and killed frames, and the fallback when a live mount fails. This reuses machinery that already exists (`LiveReviewFrame.tsx`, the image/live switch at `ScreenFrameNode.tsx:317-333`, the host handshake-injection pattern in `host/live-review-proxy.ts`) rather than inventing a new surface. "Playable" is not "editable": generation stays in the agent, so this does not reopen the "no on-canvas CSS editing" decision.

### One board-format bump, engine-independent

Units, zones, verdicts, live-source locators, per-frame kit state, and agent-authored annotations all need durable ids, so the core of them lands as one `schemaVersion: 2` bump with a migration reader, done first, before any UI reads them. Fields with no near-term reader (`documentRevision`, `reviewSummaries`) are held back to the item that consumes them, to keep the migration small. React Flow node state, iframe handles, and open islands stay in memory only, never in the saved board (holds `specs/react-flow-review-canvas.md:89`). Migration turns old lo-fi screenshots into non-playable `option-snapshot` frames and maps an old `preferred` flag to a unit nominee, never to a confirmed lock.

### The agent-collaboration and learning layer is the specced island chrome

The agent's side of the collaboration is not a new app: it maps onto the already-specced pivot chrome. Agent runs → runs island (pivot issue 08). Frame-anchored agent questions and mark threads → bloom threads (issue 09). Element explanation → learn lens; pinned answers → teach annotations, which are an agent-voiced reversed review batch that never exports into a code-change dispatch (`specs/learn-lens-teach-annotations.md`). This plan supplies the data these islands display; it does not add docked panels.

### Two load-bearing technical choices

- **Marks over live frames** need a shared media surface: mount the iframe and the normalized-mark SVG in one stack with a per-frame play/review mode. Play mode gives pointer input to the iframe; review mode takes it back for drawing and picking. This is also the fix for the current gap where the focused-live branch drops marks entirely.
- **Agent writes to the board require revisioned saves first.** Today saves are whole-document overwrites (`local-host-client.ts:169-177`). Before any agent event can mutate the board, add a compare-and-save contract (`{baseRevision, board}` → 409 on stale) plus a per-project host write queue, so an agent-authored question cannot clobber the reviewer's unsaved edits. This is a hard prerequisite for work item 4, not optional hardening.

### Performance: virtualize the live iframes

`onlyRenderVisibleElements` mounts DOM but cannot pre-warm an iframe just outside the viewport, and each live prototype carries real cost. Keep cheap screenshot shells for every frame; mount live iframes only for the active set (visible plus one screen of margin, selected/focused first), capped at a small constant (start at 6). Sandbox as `allow-scripts` without `allow-same-origin`; restore kit state on each mount from the board so unmounting is lossless. Measure the cap against representative prototypes on the target machine before recording it in `DECISIONS.md`.

## Ordered Work Items

The thin end-to-end slice is items 1 to 3, and really 1 to 2: one unit, live playable options with a kit, a verdict that locks and feeds the next prompt. Items 4 to 6 are a deliberate second pass. Schema and message contracts land before the UI that reads them. Each item ends at something checkable (unit, host, or browser).

1. **Thin end-to-end live playable option + kit.** (a) Add the `schemaVersion: 2` board shape with `parseBoardDocument`/migration and cross-record relation checks in `board-document.schema.ts` + new `board-document-migration.ts` + `board-relations.ts`; ship with all fixture updates atomically. Trim the bump to only what items 1 to 3 read: frame `kind`, `lifeState`, `unitId`, `zoneId`, `liveSource`, `kit`, plus `units`, `zones`, `verdicts`. (`documentRevision` lands with item 4a, `reviewSummaries` with item 6; neither has a reader before then, and adding them early only enlarges the migration.) Define the two shapes this item needs up front: the **kit manifest** (`{manifestVersion, controls: Array<toggle|choice with id, label, default, value>}`, stored as a checked manifest plus current `state`), and the **`liveSource`** locator (`{kind:'scratch-html', path:'/scratch/<project>/<set>/option-N.html', protocolVersion, artifactHash}` — no origin/token/port persisted). (b) Require each `option-N.html` to ship with an `option-N.kit.json` manifest; capture reads pairs, computes an `artifactHash`, writes playable frames, and injects the iframe bridge + strict content policy while serving scratch HTML (`build-lofi-generate-prompt.ts`, `capture-lofi-options.ts`, new `host/playable-option-bridge.ts`). The bridge is the **same handshake as `src/features/live-review/live-review-message.schema.ts` / `build-live-review-hello-message.ts`, on a new channel** — copy that pattern, do not reinvent it. (c) Make generation unit-aware (unit id + count; host rejects a blocked or locked unit) and add a `UnitQueueIsland`. (d) Add `PlayableOptionFrame.tsx` + `use-playable-option-connection.ts` (its own token/source/port/sequence checks, distinct from the project-route live session), a `FrameKitIsland`, and the iframe eligibility/cap in `ReactFlowReviewBoard.tsx`. **Pointer contract (highest-risk piece):** the iframe sits inside a `nodrag/nopan/nowheel` React Flow zone always, so canvas pan/zoom uses the frame margin and a drag handle, never the iframe body. In play mode the mark overlay is `pointer-events:none` and the iframe takes input; in review mode the overlay takes `pointer-events` and the iframe (still mounted) gets none. This one media stack replaces the branch at `ScreenFrameNode.tsx:317-333` and fixes the dropped-marks gap. Browser check: two options play at once, kit changes stay frame-local, pan-out-and-back and reload both restore kit state, review mode draws over the iframe, the active-iframe count never exceeds the cap.

2. **Verdict gestures and ledger.** Pure `apply-unit-verdict.ts` + `design-unit-state.ts` (promote locks the unit, archives siblings, appends one ledger row atomically; kill appends a row and moves one frame; both reject invalid state). Item 2 only sets `lifeState` (promote → winner `locked`, losers `archived`; kill → frame `killed`); item 3 owns placing archived/killed frames into a zone, so item 2 does not depend on the zone model. Stamp/strike controls on option chrome open an anchored `VerdictConfirmBloom` with one summary line; confirmation saves immediately (not on the 600ms debounce) and keeps the local row if the save fails. This immediate-save path is provisional against today's whole-doc overwrite and is reworked onto the compare-and-save contract in item 4a; do not harden it twice. A `DecisionLedgerIsland` lists confirmed rows linked to frame/unit/kit-snapshot/references. Then feed confirmed verdicts, winning HTML, and locked kit snapshots into later generation prompts (`build-lofi-generate-prompt.ts`). Recommended default for the open unit-model question: units are first-class board objects with dependency and lock state, not just labelled `optionSetId` groups.

3. **Kill and archive drag zones.** Pure `board-zone-geometry.ts` + `move-frame-to-zone.ts` (one archive and one killed zone per unit, frame-center containment, frames stay in world coordinates). `BoardZoneNode.tsx` renders greyed zones behind frames; `onNodeDragStop` archives on an archive-zone drop, opens kill confirmation on a killed-zone drop, and restores `active` when a frame is dragged out. Collapsed zones show a labelled thumbnail strip and never mount live iframes. Recommended default for the zones-vs-tabs question: in-canvas engine-free zones on one board (keeps adjacency and the drag gesture the handoff asked for), no React Flow parent ids in storage.

4. **Agent-to-canvas back-channel.** (a) First, the revisioned save contract + per-project host write queue + atomic temp-file writes (`host-data-store.ts`, `local-host-client.ts`, `use-review-board-persistence.ts`, `App.tsx`); ship atomically. (b) An append-only `canvas-events.jsonl` per run for checked agent events (`question`, `teach-answer`); the host validates, dedupes, rejects unknown frames, applies through the write queue, and emits a revisioned SSE patch that `App.tsx` merges by record id without clobbering dirty local edits. (c) Move run state into `RunsIsland`, render frame questions as `AgentQuestionBloom`s at their anchors, reduce `ReviewCommentsPanel` to a jump list. (d) Learn request → agent answer by request id → pinned `teach` annotation; teach records never enter `buildReviewBatch`.

5. **First-class references.** Extend `import-image-frames.ts` with a `reference-image` kind and optional `unitId` (dropped images link to the active unit by default); reference frames move, resize, and take marks but never mount live. The verdict form pre-selects the unit's references; deleting a reference never rewrites an old verdict (it shows "reference missing"). Copy linked reference bytes into the run asset dir and list them in generation prompts.

6. **Review telemetry (exploration leaves traces).** A bounded `review-telemetry.ts` accumulator counts dwell only while a frame is active, at least half in the viewport, page visible; it combines repeated kit states (cap 50/frame) and stores totals, not an event log. The React Flow adapter reports visibility ratios; `PlayableOptionFrame` reports live-ready and kit changes. Surface only "reviewed / not reviewed", rounded visible seconds, and count of kit states tried; the verdict confirmation warns (does not block) when the winner was never played live or siblings went unreviewed. Prompts get the same totals, never raw timings.

## Open Questions

**Gate item 1 (lock before a builder starts) — the plan states a recommended default; confirm or override:**

- **Kit manifest ownership.** Does the agent emit a control manifest per prototype that the host mirrors as an external dial island, or does the injected in-frame strip stay the only surface? The plan assumes the former (a stable dial even when the iframe unmounts), which sets the postMessage scope and whether `FrameKitIsland` exists in 1d. Decide before 1b.
- **Units as first-class object vs labelled group.** Recommended default: first-class board objects with dependency and lock state, not just labelled `optionSetId` groups. This sets how much schema item 1a adds, so it gates item 1.

**Genuinely open, needed later:**

- **Live iframe count before jank.** No fixed browser limit; cost is per-prototype. The plan starts the cap at 6 active iframes but it needs a measured active-set budget on the target machine before it goes into `DECISIONS.md`. (Shapes item 1d.)
- **Archive model.** Recommended default: in-canvas greyed zones on one board (keeps adjacency and the drag gesture), no React Flow parent ids in storage. Confirm before item 3.
- **Handoff target for "build for real".** Named file/route vs agent-decided placement (carried over, still open). Needed for the feed-forward-to-real-build step, not the thin slice.

## References

- Handoff (target workflow): `.context/attachments/Mi4BTL/pasted_text_2026-07-21_15-10-54.txt`
- Superseded plan: `docs/plans/canvas-lofi-option-studio-2026-07-21.md`
- Pivot island chrome: `.scratch/designmode-pivot/spec.md`, `specs/learn-lens-teach-annotations.md`, `specs/redesign-visual-system.md`
- Canvas/host locks: `specs/react-flow-review-canvas.md`, `specs/design-mode-host.md`, `design/HANDOFF.md`, `DECISIONS.md`
- Live iframe on pan/zoom canvas (transform scale, pointer ownership, virtualization, sandbox): MDN iframe/sandbox, web.dev iframe lazy loading, React Flow viewport API
- Host↔iframe kit protocol: MDN `postMessage`, opaque origins, `MessageChannel`
- Prior art: MagicPath 2.0 changelog (shared human/agent canvas, side-by-side takes, parallel threads), tldraw embed shape + 2026 license (rejected), Figma variation generator, v0 Design Mode, Subframe, Onlook
