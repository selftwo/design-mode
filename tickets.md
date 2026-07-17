# Tickets: React Flow review canvas

These tickets turn the approved React Flow review canvas spec into executable slices. The source is `specs/react-flow-review-canvas.md`.

Work the **frontier**: any ticket whose blockers are all done. Use the `implement` skill for one ticket at a time and clear context between tickets.

## Load validated boards through a host boundary

**What to build:** Let a reviewer open a board supplied by a local host. Show useful errors for invalid data and unsupported schema versions while keeping the canvas independent of the host implementation.

**Blocked by:** None, can start immediately.

- [x] A versioned, validated host message loads a board into the React Flow canvas.
- [x] Invalid board data and unsupported versions show clear errors without replacing the current board.
- [x] The product path no longer depends on the generated pressure fixture for board loading.
- [x] A fake host proves successful load and failure behavior at the application boundary.
- [x] The 50 screen pressure board can still be loaded through the same boundary.

## Create and manage review annotations

**What to build:** Let a reviewer create point comments and circle marks, write useful instructions, select existing annotations, edit them, and delete mistakes while marks remain fixed to screen content.

**Blocked by:** Load validated boards through a host boundary.

- [x] Creating a point comment or circle selects the new annotation and opens instruction editing.
- [x] Instructions can be edited and saved as drafts.
- [x] Existing annotations can be selected and deleted.
- [x] Empty instructions remain drafts and are visibly incomplete.
- [x] Marks remain within 2 CSS pixels of their normalized location after frame move, resize, pan, and zoom.
- [x] The full pointer workflow is covered through the React Flow browser route.

## Save and reset boards safely

**What to build:** Let a reviewer save validated work, restore it after reload, understand save failures, and reset only after confirming that changed work may be lost.

**Blocked by:** Load validated boards through a host boundary.

- [x] Save validates the semantic board document before writing it.
- [x] Frame geometry, camera state, annotations, and capture history survive reload.
- [x] A storage failure leaves the current in memory board unchanged and shows a clear error.
- [x] Reset asks for confirmation when the board differs from its last saved state.
- [x] Reset returns to the host supplied board rather than a generated fixture.
- [x] Browser coverage proves save, reload, failure, and reset behavior.

## Inspect live frames and refresh captures

**What to build:** Let a reviewer inspect a host supplied live page inside a selected screen frame, understand connection failures, return to a refreshed capture, and see which annotations refer to an older capture.

**Blocked by:** Load validated boards through a host boundary.

- [x] The host supplies the live URL, allowed origin, and a fresh focus token.
- [x] Live messages are accepted only when origin, source window, schema, and token match.
- [x] Connecting, ready, unavailable, and refresh failure states are visible.
- [x] Leaving live mode requests a refreshed capture from the host.
- [x] A successful refresh replaces current capture references and increments the frame revision.
- [x] Existing annotations retain their original capture identity and become visibly stale.
- [x] Browser and focused message tests cover success, rejection, timeout, cleanup, and refresh failure.

## Export a validated review batch

**What to build:** Let a reviewer export every complete draft annotation as one agent neutral review batch and deliver it to the local host with clear validation errors.

**Blocked by:** Create and manage review annotations; Inspect live frames and refresh captures.

- [x] A versioned review batch schema contains board identity and all exportable annotations.
- [x] Each record contains route, viewport, marks, anchor, and the capture identity used during review.
- [x] Screenshot references must be project relative and absolute paths are rejected.
- [x] Empty instructions block export and identify the affected annotations.
- [x] The batch contains no coding agent, model, command, or vendor field.
- [x] The validated batch is delivered through the host boundary.
- [x] A browser flow proves successful delivery and visible validation failure.

## Complete the keyboard review workflow

**What to build:** Let a reviewer complete the main review flow without a pointer and understand selection, focus, tool, save, live frame, and export state through visible and announced feedback.

**Blocked by:** Create and manage review annotations; Save and reset boards safely; Inspect live frames and refresh captures; Export a validated review batch.

- [x] Tools, frames, annotations, instruction editing, save, reset, live mode, and export are keyboard reachable.
- [x] Visible focus identifies the active control or review item.
- [x] Selection, save, connection, stale annotation, validation, and export results are announced.
- [x] Drawing and movement modes remain distinct and show their active state.
- [x] One Chromium browser flow completes the review workflow using keyboard input where the interaction supports it.

## Keep optional engines outside the default route

**What to build:** Ship React Flow as the default canvas without making optional engines part of its initial load, while preserving a small Excalidraw compatibility path for the shared board document.

**Blocked by:** Load validated boards through a host boundary.

- [x] The default route loads React Flow without loading Excalidraw JavaScript, styles, or fonts.
- [x] The default React Flow initial gzip bundle stays within 20 percent of the recorded 116,567 byte reference.
- [x] Excalidraw remains available only through an explicit optional route or adapter selection.
- [x] A compatibility flow proves Excalidraw can consume the shared board document.
- [x] React Flow feature parity is not required from the optional adapter.

## Prepare the dependency tree for release

**What to build:** Give maintainers a clear release gate for dependency security and licenses so the open source package is not published with unreviewed known findings.

**Blocked by:** Keep optional engines outside the default route.

- [x] Current production dependency audit findings are listed by affected runtime path and practical exposure.
- [x] Findings are fixed, removed, or accepted with a recorded reason before release.
- [x] React Flow and Excalidraw license use is verified for the public repository.
- [x] tldraw is not added as a shipped dependency.
- [x] The release check fails when an unreviewed high severity production finding is present.

## Verify the complete React Flow review flow

**What to build:** Prove the complete default canvas workflow with the 50 screen pressure board and make the result the release gate for this slice.

**Blocked by:** Save and reset boards safely; Complete the keyboard review workflow; Keep optional engines outside the default route; Prepare the dependency tree for release.

- [x] One Chromium workflow loads 50 mixed size screens through the host boundary.
- [x] The workflow covers selection, move, resize, pan, zoom, point comments, circles, instruction editing, deletion, persistence, live mode, refresh, stale feedback, and review batch export.
- [x] Annotation drift remains within 2 CSS pixels after geometry and camera changes.
- [x] The workflow has no uncaught page errors or unexpected console errors.
- [x] Model, host boundary, live message, production build, bundle, dependency, and browser checks all pass through `npm run verify`.

## Act on the first manual review recording

**What to build:** Fix the workflow problems found in the 2026-07-16 manual test recording: canvas panning, freehand circle accuracy, comment pin interaction, save noise, and export visibility.

**Blocked by:** Verify the complete React Flow review flow.

- [x] Left drag and trackpad scroll pan the canvas in every tool.
- [x] The circle tool fits the mark to the whole freehand path and previews it while drawing.
- [x] Comment marks render as numbered pins that open the editor from any tool for edit or delete.
- [x] The board autosaves; the toolbar has no Save button and the footer shows the live save state.
- [x] A delivered export offers Copy JSON and the manual test host displays the received batch.
- [x] Tool buttons are icons with accessible names.

## Break screens into design elements and pool comments

**What to build:** Freehand ink marks, host-captured element picking, and a pooled comments panel with one send or copy, from the second manual review recording (2026-07-16).

**Blocked by:** Act on the first manual review recording.

- [x] The draw tool stores and renders the simplified freehand path exactly as drawn.
- [x] Frames carry host-extracted element bounds; select mode hover-highlights and picks them.
- [x] Picking an element pools a comment bound to it; picking it again reopens that comment.
- [x] A comments panel lists the pool with per-item copy and the inline instruction editor.
- [x] Copy all validates the pool and copies the batch; Send to host delivers it at once.
- [x] Exported annotations carry the picked element in the elements field.

## Become a local app with projects, context, intents, and agent dispatch

**What to build:** A one-command local host (`npm run app`) that owns project registration, screen capture, board persistence, design context, live proxying, and dispatch to Claude Code, Codex, or Cursor, with agent runs visible on the board like collaborators. Plus image import and Impeccable-style design intents on comments.

**Blocked by:** Break screens into design elements and pool comments.

- [x] Annotations carry an optional design intent chip that exports with the batch.
- [x] Dropped or picked images become annotatable frames placed beside existing screens.
- [x] The host registers projects, boots their dev servers, and captures routes with element bounds.
- [x] Boards persist through the host API; autosave and reset work against it.
- [x] The context pane shows DESIGN.md, PRODUCT.md, AGENTS.md, and README.md from the project.
- [x] Send dispatches the validated batch to a chosen agent; runs are journaled with prompt and screenshots.
- [x] Run and capture events stream to the canvas; the activity rail shows agent presence and output.
- [x] A finished run re-captures screens with a merge that preserves layout and annotations.
- [x] Live view proxies any registered project page with an injected handshake.
