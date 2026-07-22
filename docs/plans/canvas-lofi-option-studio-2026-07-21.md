---
title: Canvas as a lo-fi option studio — generate, compare, pick, hand off
status: draft
date: 2026-07-21
---

## Goal

Turn the review canvas into a design-exploration surface. Ask an agent for several lo-fi prototype options, render them as frames on one board, compare them with full visual context, pick the preferred one, and hand that option (its HTML plus your marks) back to the agent to build for real. This replaces the slow round trip of building a real screen on localhost, refreshing, and reviewing just to see a single option. Lo-fi option frames live alongside real captured-route frames on the same board.

## Background

### The loop we're replacing

Today the only way to see a design is for the agent to build it into the real app, then refresh localhost and capture it. Every option costs a full build-and-refresh trip, and you end up comparing options across time (one refresh after another) instead of side by side. The ask: let the canvas hold many lo-fi options at once, because a canvas view carries far more visual reference to feed back to an agent than a single screenshot in chat.

### What already exists to build on

- **Host capture pipeline.** The host renders routes with Playwright, extracts element bounds, and merges re-captures without losing frame positions (`capture-project-board.ts`, `extract-frame-elements.ts`, `merge-captured-frames.ts`).
- **Agent-neutral dispatch.** Validated batches go to Claude / Codex / Cursor with SSE runs and a re-capture merge on completion.
- **Board model.** Frames are React Flow nodes built from a Zod `BoardDocumentSchema`; marks are stored **normalized to the frame** (0..1) via `board-geometry.ts`; persistence is host `PUT` plus local autosave.
- **Manipulation is thin.** Drag works but is select-tool-gated and has no affordance; resize is aspect-locked and its handles are clipped by the node root's `overflow: hidden`.

| Concern | File |
| --- | --- |
| React Flow board + drag/camera | `src/features/review-board/engines/react-flow/ReactFlowReviewBoard.tsx` |
| Frame node, resizer, marks UI | `src/features/review-board/engines/react-flow/ScreenFrameNode.tsx` |
| Board document (Zod) | `src/features/review-board/model/board-document.schema.ts` |
| Geometry / normalized coords | `src/features/review-board/model/board-geometry.ts` |
| Host capture + merge | `host/`, `merge-captured-frames.ts`, `extract-frame-elements.ts` |
| Agent dispatch | agent-neutral batch + SSE (review-board dispatch) |
| Host board API | `src/local-host/local-host-client.ts`, `host/design-mode-host.ts` |

### What's settled (and how this reframe fits)

- **Generation stays in the CLI/agent.** This reframe keeps that intact: the agent generates the lo-fi HTML; only the rendered outputs live on the canvas for comparison and selection. No live style editing on the canvas.
- **No new runtime deps** for the canvas; React Flow default; **tldraw rejected on license** (`DECISIONS.md:15-25`). tldraw stays a documented fallback only if a prototype proves React Flow can't reach the feel bar.

## Approach

### The loop we're building

1. You describe a component or screen (a prompt, optionally anchored to an existing frame or marks as reference).
2. The agent generates N **standalone lo-fi HTML/CSS options** — wireframe fidelity, self-contained files, not wired into the real app. Reuses the agent-neutral dispatch.
3. The host serves and screenshots each option through the **existing Playwright capture** into frames, tagged as lo-fi options and grouped as one option set.
4. You arrange and compare the options on the board, mark them up, and pick the preferred one.
5. You send the chosen option — its HTML source plus your marks and a target location in the real codebase — back to the agent to build for real. Reuses the agent-neutral batch and the re-capture merge, so the real build returns as a captured-route frame alongside.

Why this is fast: lo-fi options are throwaway standalone files, so rendering them never touches the real localhost or requires wiring into the app. You skip the build-and-refresh round trip during exploration.

### Two decisions you made, recorded

- **Standalone HTML, host-rendered.** Agent-written standalone HTML reuses the capture pipeline, keeps generation in the agent, and the chosen option is real code, so handoff is a concrete build reference, not just a picture. Image generation (Codex/Grok) stays available for the roughest early sketches, but HTML is the default.
- **Lo-fi and real frames on one board.** Each frame carries its `source` (`lofi-option` | `captured-route`) and, for options, which generation set it belongs to. One board holds both, so you can compare a lo-fi option against the real current screen.

### Engine: still extend React Flow

Arranging and comparing options makes drag and clean resize matter more, not less, so the feel-fix still pays off. React Flow already ships the primitives (`NodeResizer`/`NodeResizeControl`, node drag). Migrating to tldraw would mean rewriting the normalized mark/anchor/host layer for a feel problem that has a cheaper fix, so it stays a fallback (Item spine below).

## Work Items (this plan)

The spine is a thin end-to-end slice of the loop, stubbed first, then made real. The feel-fix supports the compare step.

1. **Prototype the loop (throwaway).** Stub the whole loop with fake data: hardcode 3 lo-fi HTML options, run them through the existing capture into frames, tag them as one option set, add a "prefer" toggle, and produce the handoff payload for the chosen one. Behind a URL flag. Goal: feel compare-and-pick end to end before building the real generation path, and check that arranging options on this canvas feels good.
2. **Generate lo-fi options into files.** DONE (generation half). Shipped: `POST /api/projects/:id/generate-options` (`{agent, prompt, count}`, `GenerateOptionsRequestSchema`) launches an agent run via `launchLofiGenerateRun` (mirrors `launchAgentRun`'s journal + spawn + SSE lifecycle). The agent writes `option-1.html`..`option-N.html` into a per-option-set scratch dir under the host data dir (`store.optionSetDir(projectId, runId)` = `~/.design-mode/scratch/<project>/<runId>/`), not the project repo, so generation never dirties the user's tree. Prompt from `build-lofi-generate-prompt.ts` (standalone, low-fidelity, one direction per file). Client: `localHost.generateOptions({prompt, count})`. Tested with a fake agent that writes option files. Note: the option set is keyed by the run id. **Not yet built:** the in-app trigger UI (a "Generate options" input), and passing an optional reference frame/marks.
3. **Host renders and captures options into frames.** DONE. New `host/capture-lofi-options.ts` (`listOptionFiles`, `captureLofiOptions`) renders each `option-*.html` through the same Playwright capture as a real route (`extract-frame-elements`), tagging frames `source: 'lofi-option'` and `optionSetId`. The host serves the scratch dir itself over `/scratch/:projectId/:optionSetId/:file` (path-traversal guarded), so no project dev server is involved. Once a generate-options run finishes successfully, the host captures the option set and merges it onto the board via the existing `mergeCapturedFrames` (reused as-is: new option ids never match existing frames, so they always append), gated by the same `recaptureAfterRun` test seam used for real captures. **Not yet built:** compare/pick UI (Item 5) and the "build for real" handoff (Item 6) for options that reach the board this way.
4. **Frame provenance + selection in the model.** DONE. Extended `ScreenFrameSchema` with `source` (`'captured-route' | 'lofi-option'`, defaulted), `optionSetId`, and `preferred`. No `schemaVersion` bump: the repo has no migration mechanism for board schema versions (checked — none exists), and the new fields are optional/defaulted, so older persisted boards keep parsing unchanged. All existing frame-construction call sites (capture, upload import, pressure-test fixtures, e2e fixtures) now set `source` explicitly.
5. **Compare + pick affordances on the canvas.** DONE (canvas half). `ScreenFrameNode` now shows a dashed border + "Option" badge for `source: 'lofi-option'` frames, and a "Prefer" toggle chip (overlaid inside the clipped surface, not in the external label strip above it — an earlier version placed it there and a real-browser check caught it landing under the toolbar for frames near the world origin) that flips the frame's `preferred` field through the same `onDocumentChange` path as resize, so it autosaves like any other edit. Clustering is free: `mergeCapturedFrames` already lays a new option set out contiguously. Also shipped the trigger this needed to be reachable at all: `GenerateOptionsPanel` (collapsible, local-host-only) posts to `generate-options` via the existing `localHost.generateOptions` client method. **Not yet built:** a dedicated list/compare view across an option set (today you compare by looking at the clustered frames directly), and the Item 6 handoff for frames that reach the board through the real path (only the proto panel has a handoff preview).
6. **Send preferred option to the agent to build for real.** Dispatch payload = chosen option's HTML source + marks + a target location in the real codebase. Reuses the agent-neutral batch, SSE run, and re-capture merge.
7. **Feel-fix (supporting): drag + resize affordance.** DONE (affordance part). Correction: the "handles clipped by `overflow: hidden`" claim came from the *other* checkout's `DECISIONS.md` and does **not** hold in this branch — `.screen-node` has no `overflow: hidden`, only the sibling `.screen-content` does, so nothing clips the resizer. Drag and aspect-locked resize already worked; what was missing was discoverability. Shipped: a grab/grabbing cursor on movable frames (`data-draggable` on `.screen-node`) and clearly visible resize handles/lines (`frame-resize-handle` / `frame-resize-line`) in place of xyflow's faint defaults, plus a `board-geometry` test proving a normalized mark stays pinned across an aspect-locked resize. **Deferred:** free-reshape mode — it needs the changed `onResize` signature (`resizeFrameAspectLocked` takes width only, `board-geometry.ts:67-74`), the `aspectRatio`-staleness decision, and a mode toggle, so it moves to "Later / separately scoped".

## Later / separately scoped

- **Breakpoint reshape + real re-capture.** Still valid but secondary; blocked on the marks-on-re-capture decision, because normalized anchors do **not** survive a content reflow (a mobile re-capture moves content out from under the mark).
- **Free-reshape mode** (deferred from Item 7): a width+height resize that breaks aspect, needing a new geometry function, a changed `onResize` signature, a mode toggle, and a decision on whether to recompute `aspectRatio` after a distort.
- **Per-component actions and variants within a single option** (act on one captured element inside a frame).
- **Landing the pivot island chrome** (islands/dodge/bloom/learn-lens) — specced in `.scratch/designmode-pivot/`, absent from this branch, part of why the app feels unfinished.

## Open Questions

These change the build and should be answered before the item that depends on them:

- ~~Where do lo-fi HTML files live and how does the host serve them for capture?~~ **Resolved (Item 2/3):** `~/.design-mode/scratch/<project>/<runId>/`, served by the host itself over `/scratch/:projectId/:optionSetId/:file`.
- **Generation count and re-generation semantics.** Count is a caller-supplied `1..6` (default 3, `GenerateOptionsRequestSchema`). Re-generating always **adds** a new option set rather than replacing one: each run gets a fresh `runId`, so its frame ids never collide with a prior set's — this fell out of reusing `mergeCapturedFrames` unchanged rather than a deliberate product decision, so revisit if the board gets cluttered with old option sets.
- **Handoff target.** Does "build for real" target a file/route the user names, or does the agent decide placement? Changes the Item 6 payload.
- **Pivot-chrome ordering vs the feel-fix.** The island re-skin restructures the same node DOM Item 7 touches; decide whether to land it first or fold Item 7 into it, before starting Item 7.

## References

- MagicPath canvas: https://www.magicpath.ai/documentation/features/canvas
- MagicPath v2 changelog: https://www.magicpath.ai/documentation/changelog/magicpath-2
- Prior status write-up: `.context/design-canvas-status-prfaq.md`
- Pivot specs: `.scratch/designmode-pivot/`, `specs/react-flow-review-canvas.md`, `design/HANDOFF.md`, `DECISIONS.md`
