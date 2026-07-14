---
title: Ship React Flow as the default review canvas
status: ready-for-agent
---

## Problem Statement

People reviewing web interfaces need one local place to arrange captured screens, mark exact areas, write clear instructions, inspect a live page when a screenshot is not enough, and hand validated review data to any coding agent.

The engine spike proves that React Flow can support the core canvas interactions with 50 screens. It does not yet provide a complete review workflow. It uses generated fixtures, fixed annotation text, one annotation export, and a fixed live page. A product implementation needs a clear boundary around the canvas so capture tools and agent adapters can be added without changing review data.

## Solution

Build the first open source review canvas on React Flow. A host supplies a validated board document containing captured screen frames. The reviewer arranges frames, pans and zooms, creates point comments and circle marks, edits review instructions, enters a live frame, returns to a refreshed capture, saves work, and exports a validated review batch.

Keep the board document and review batch independent of React Flow and of any coding agent. React Flow is the default view engine. Excalidraw remains an optional adapter that may consume the same board document, but it does not set requirements for the first release.

## User Stories

1. As a reviewer, I want to open a board supplied by my local host, so that I can review captured screens from a real project.
2. As a reviewer, I want invalid board data to be rejected with a clear error, so that I do not edit corrupted or unsupported data.
3. As a reviewer, I want an unsupported schema version to be identified, so that I know the board needs migration or a newer app.
4. As a reviewer, I want all captured screens to appear on one infinite canvas, so that I can compare related routes and viewports.
5. As a reviewer, I want each screen to show its label, route, and viewport, so that I know what I am reviewing.
6. As a reviewer, I want screenshots to keep their source aspect ratio, so that the canvas does not distort the interface.
7. As a reviewer, I want to pan with pointer input, so that I can move around a large board.
8. As a reviewer, I want to zoom around the pointer position, so that I can inspect details without losing context.
9. As a reviewer, I want clear zoom limits, so that the board remains usable at every scale.
10. As a reviewer, I want to select a screen, so that actions apply to the intended frame.
11. As a reviewer, I want to move a selected screen, so that I can organize the board around my review task.
12. As a reviewer, I want to resize a screen without changing its aspect ratio, so that I can balance detail and board space.
13. As a reviewer, I want frame positions and sizes to remain stable after save and reload, so that I can resume my review.
14. As a reviewer, I want the camera position and zoom to remain stable after save and reload, so that I return to the same place.
15. As a reviewer, I want to add a point comment to a screen, so that I can refer to an exact location.
16. As a reviewer, I want to draw a circle around an area, so that I can show the full region covered by an instruction.
17. As a reviewer, I want a new annotation to open for instruction editing, so that I can replace placeholder text before export.
18. As a reviewer, I want to edit an existing instruction, so that I can clarify feedback as I review.
19. As a reviewer, I want to delete an annotation, so that mistakes are not sent to an agent.
20. As a reviewer, I want to see which annotation is selected, so that editing and deletion are predictable.
21. As a reviewer, I want marks to stay attached to the same normalized screen location after move, resize, pan, and zoom, so that feedback remains precise.
22. As a reviewer, I want annotations to record the capture revision they were made against, so that later changes do not hide stale feedback.
23. As a reviewer, I want stale annotations to be visibly identified after a screen refresh, so that I can decide whether they still apply.
24. As a reviewer, I want a stale annotation to retain its original capture reference, so that an agent can understand the evidence behind it.
25. As a reviewer, I want to enter a live version of a selected screen inside its frame, so that I can inspect behavior that a screenshot cannot show.
26. As a reviewer, I want the live frame to report whether it is connecting, ready, or unavailable, so that I understand its state.
27. As a reviewer, I want only messages from the expected live frame and origin to be accepted, so that another page cannot impersonate it.
28. As a reviewer, I want to leave live mode and receive a refreshed capture, so that the board reflects the state I inspected.
29. As a reviewer, I want existing annotations to remain tied to their original capture after refresh, so that review history is preserved.
30. As a reviewer, I want to save only validated board data, so that stored work can be trusted when restored.
31. As a reviewer, I want a clear save result, so that I know when my work is safe.
32. As a reviewer, I want storage failures to preserve my in memory work and show a clear error, so that a failed save does not silently lose data.
33. As a reviewer, I want to reset a board only after a clear confirmation, so that I do not erase work by mistake.
34. As a reviewer, I want to export all draft annotations as one review batch, so that I can send one coherent request to an agent adapter.
35. As a reviewer, I want empty instructions to block export, so that an agent never receives unusable feedback.
36. As a reviewer, I want an export validation error to identify the affected annotation, so that I can fix it.
37. As a reviewer, I want exported screenshot paths to be project relative, so that another local process can resolve them safely.
38. As a reviewer, I want the review batch to include route, viewport, marks, anchor, and capture identity, so that an agent has enough context to act.
39. As a reviewer, I want export to avoid naming a specific coding agent, so that I can choose an adapter later.
40. As a keyboard user, I want to reach tools, frames, annotations, save, and export actions without a pointer, so that I can complete the review workflow.
41. As a keyboard user, I want visible focus and announced selection changes, so that canvas state is understandable.
42. As a reviewer, I want drawing and movement modes to be distinct, so that a pan or drag does not create an annotation by accident.
43. As a reviewer, I want controls to show their active state, so that I know what the next pointer action will do.
44. As a reviewer, I want the board to remain responsive with 50 mixed size screens and dense annotations, so that real projects remain practical.
45. As a maintainer, I want the React Flow bundle to load separately from optional engines, so that optional adapters do not increase the default route cost.
46. As a maintainer, I want stored data and process messages validated by schemas, so that boundary failures are caught close to their source.
47. As a maintainer, I want TypeScript types inferred from boundary schemas, so that runtime and compile time contracts stay aligned.
48. As an adapter author, I want the canvas engine interface to use the board document rather than React Flow node data, so that another engine can be added without changing the model.
49. As an adapter author, I want a validated review batch contract, so that CMUX, Pi, OpenCode, Grok, Codex, or Claude Code adapters can consume the same output.
50. As an open source user, I want the default canvas dependency to use an MIT license, so that I can reuse the public repository without a separate production license.

## Implementation Decisions

- React Flow is the default and required canvas engine for the first release.
- Excalidraw remains an optional adapter. It must not be loaded by the default route.
- tldraw is not a shipped dependency because its production license does not give every downstream public repository user a no license default.
- The application stays in one package until a local service process exists. Code remains grouped by the feature that owns it.
- The canvas is bounded by two validated contracts. It receives a board document and produces a review batch.
- Board data stays independent of React Flow nodes. Engine code projects the board document into view state and writes user changes back through the canvas engine interface.
- Stored board documents, review batches, and live frame messages use versioned Zod schemas. TypeScript types are inferred from those schemas.
- A board contains a schema version, board identity, camera, screen frames, and annotations.
- A screen frame contains stable identity, route, viewport, world position, display size, aspect ratio, capture references, capture hash, and revision.
- Annotation anchors and mark points use normalized coordinates from zero to one within a screen frame.
- A review annotation records its instruction and the capture hash and revision that existed when the annotation was created.
- The product supports point comments and circle marks in this slice. Each annotation has one instruction and one optional mark.
- Creating an annotation immediately selects it and opens its instruction editor.
- Empty or whitespace only instructions may be saved as drafts but cannot be exported.
- Moving and resizing frames changes frame geometry only. It does not rewrite normalized annotation geometry.
- Resizing preserves the source aspect ratio.
- The canvas saves semantic board data. React Flow view objects and DOM state are never stored.
- Storage errors are visible and do not replace the current in memory board.
- Reset requires confirmation when the board differs from its last saved state.
- Live mode renders the target page inside the selected React Flow screen node.
- The host supplies the live URL, allowed origin, and a fresh focus token. The canvas must not contain a fixed fixture origin in product code.
- Live messages are accepted only when the origin, source window, message schema, and focus token all match.
- Leaving live mode asks the host for a new capture. A successful refresh increments the frame revision and replaces its current capture references.
- Existing annotations keep the capture identity they were made against. The interface marks them stale when that identity differs from the current frame.
- Export produces one versioned review batch containing all exportable draft annotations and the board identity.
- Review batch records use project relative screenshot references. Absolute paths are rejected at the export boundary.
- The review batch does not contain an agent name, command, executable path, or vendor specific field.
- The host owns board production, screenshot capture, refreshed capture, project path resolution, and delivery of the review batch to a command adapter.
- The default route keeps the React Flow initial gzip bundle within the measured spike budget plus a 20 percent allowance. The current measured reference is 116,567 bytes gzip.
- Annotation drift after move, resize, pan, and zoom must stay at or below 2 CSS pixels. The spike measured less than 0.7 CSS pixels.
- The supported first browser is current Chromium. Broader browser support is a later compatibility decision.
- Dependency findings must be reviewed before release. The spike with 9 moderate and 2 high audit findings is not a publishable production baseline.

## Testing Decisions

- Tests assert behavior at public boundaries. They do not inspect React component state or depend on private React Flow data structures.
- The primary seam is one full Chromium browser workflow through the default React Flow route.
- The browser workflow loads a 50 screen board, selects and moves a frame, resizes it with its aspect ratio locked, pans, zooms, draws a circle, adds a point comment, edits instructions, deletes an annotation, saves, reloads, enters and exits live mode, handles a refreshed capture, identifies stale feedback, and exports a review batch.
- The browser workflow uses real pointer and keyboard input. It verifies visible results and validated diagnostic output at the application boundary.
- The browser workflow measures annotation drift after move, resize, pan, and zoom. Each result must remain within the 2 CSS pixel limit.
- The browser workflow verifies that no uncaught page error or unexpected console error occurs.
- The browser workflow records route readiness and bundle measurements for regression review. Timing data is diagnostic unless a stable continuous integration threshold is established.
- Focused model tests cover schema acceptance, schema rejection, version rejection, normalized geometry, storage round trips, stale capture identity, and review batch export.
- Focused live message tests cover wrong origin, wrong source window, invalid data, wrong token, retry behavior, ready state, timeout, and cleanup.
- Focused host boundary tests use a fake host to cover board load, capture refresh success, capture refresh failure, and review batch delivery without starting a real coding agent.
- Prior art is the existing 50 screen pressure workflow and the model tests for normalized anchors, stored board validation, and agent neutral annotation export.
- Excalidraw keeps a smaller compatibility workflow that proves it can consume the shared board document. Feature parity with React Flow is not a release gate for this slice.
- A good test remains valid if React components are reorganized or the React Flow projection changes while user behavior and contracts stay the same.
- `npm run verify` is the required handoff check.

## Out of Scope

- Producing the initial screenshots and board document from a real browser session.
- Running a screenshot capture service.
- Dispatching a review batch to CMUX or any coding agent.
- Choosing an agent, model, command, permission mode, or working directory.
- Tracking agent execution, streaming output, cancellation, or retries.
- Applying code changes and refreshing the board after an agent finishes.
- Requiring Excalidraw feature parity.
- Shipping tldraw.
- Freehand drawing, arrows, rectangles, text placed directly on the canvas, and image editing.
- Multiuser boards, remote storage, accounts, permissions, and cloud sync.
- Mobile and touch first layouts.
- Browser support beyond current Chromium.
- Publishing the current dependency tree without resolving or accepting its audit findings.

## Further Notes

The engine spike provides enough evidence to proceed with this canvas slice. It proves the highest risk engine behaviors with 50 screens, including real pointer input, frame geometry, annotation anchoring, persistence, export shape, live iframe use, refreshed capture history, bundle size, and error free Chromium execution.

The full working prototype still needs separate legwork before it can run against a real project:

1. Define and prove board production, including route discovery, viewport selection, screenshot paths, capture hashes, and the host handoff into the canvas.
2. Define and prove the local host protocol for refreshed capture and review batch delivery.
3. Define and prove agent dispatch through command adapters after the review batch contract is stable.
4. Decide how a local project and its board are selected and resumed when more than one project exists.
5. Review dependency audit findings and set an open source release policy.

These are dependent slices, not hidden requirements for the React Flow engine. Board production must exist before a real project can be reviewed. The host protocol must exist before capture refresh and batch delivery can work outside fixtures. Agent dispatch depends on the review batch contract from this spec.
