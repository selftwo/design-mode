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

- [ ] Creating a point comment or circle selects the new annotation and opens instruction editing.
- [ ] Instructions can be edited and saved as drafts.
- [ ] Existing annotations can be selected and deleted.
- [ ] Empty instructions remain drafts and are visibly incomplete.
- [ ] Marks remain within 2 CSS pixels of their normalized location after frame move, resize, pan, and zoom.
- [ ] The full pointer workflow is covered through the React Flow browser route.

## Save and reset boards safely

**What to build:** Let a reviewer save validated work, restore it after reload, understand save failures, and reset only after confirming that changed work may be lost.

**Blocked by:** Load validated boards through a host boundary.

- [ ] Save validates the semantic board document before writing it.
- [ ] Frame geometry, camera state, annotations, and capture history survive reload.
- [ ] A storage failure leaves the current in memory board unchanged and shows a clear error.
- [ ] Reset asks for confirmation when the board differs from its last saved state.
- [ ] Reset returns to the host supplied board rather than a generated fixture.
- [ ] Browser coverage proves save, reload, failure, and reset behavior.

## Inspect live frames and refresh captures

**What to build:** Let a reviewer inspect a host supplied live page inside a selected screen frame, understand connection failures, return to a refreshed capture, and see which annotations refer to an older capture.

**Blocked by:** Load validated boards through a host boundary.

- [ ] The host supplies the live URL, allowed origin, and a fresh focus token.
- [ ] Live messages are accepted only when origin, source window, schema, and token match.
- [ ] Connecting, ready, unavailable, and refresh failure states are visible.
- [ ] Leaving live mode requests a refreshed capture from the host.
- [ ] A successful refresh replaces current capture references and increments the frame revision.
- [ ] Existing annotations retain their original capture identity and become visibly stale.
- [ ] Browser and focused message tests cover success, rejection, timeout, cleanup, and refresh failure.

## Export a validated review batch

**What to build:** Let a reviewer export every complete draft annotation as one agent neutral review batch and deliver it to the local host with clear validation errors.

**Blocked by:** Create and manage review annotations; Inspect live frames and refresh captures.

- [ ] A versioned review batch schema contains board identity and all exportable annotations.
- [ ] Each record contains route, viewport, marks, anchor, and the capture identity used during review.
- [ ] Screenshot references must be project relative and absolute paths are rejected.
- [ ] Empty instructions block export and identify the affected annotations.
- [ ] The batch contains no coding agent, model, command, or vendor field.
- [ ] The validated batch is delivered through the host boundary.
- [ ] A browser flow proves successful delivery and visible validation failure.

## Complete the keyboard review workflow

**What to build:** Let a reviewer complete the main review flow without a pointer and understand selection, focus, tool, save, live frame, and export state through visible and announced feedback.

**Blocked by:** Create and manage review annotations; Save and reset boards safely; Inspect live frames and refresh captures; Export a validated review batch.

- [ ] Tools, frames, annotations, instruction editing, save, reset, live mode, and export are keyboard reachable.
- [ ] Visible focus identifies the active control or review item.
- [ ] Selection, save, connection, stale annotation, validation, and export results are announced.
- [ ] Drawing and movement modes remain distinct and show their active state.
- [ ] One Chromium browser flow completes the review workflow using keyboard input where the interaction supports it.

## Keep optional engines outside the default route

**What to build:** Ship React Flow as the default canvas without making optional engines part of its initial load, while preserving a small Excalidraw compatibility path for the shared board document.

**Blocked by:** Load validated boards through a host boundary.

- [ ] The default route loads React Flow without loading Excalidraw JavaScript, styles, or fonts.
- [ ] The default React Flow initial gzip bundle stays within 20 percent of the recorded 116,567 byte reference.
- [ ] Excalidraw remains available only through an explicit optional route or adapter selection.
- [ ] A compatibility flow proves Excalidraw can consume the shared board document.
- [ ] React Flow feature parity is not required from the optional adapter.

## Prepare the dependency tree for release

**What to build:** Give maintainers a clear release gate for dependency security and licenses so the open source package is not published with unreviewed known findings.

**Blocked by:** Keep optional engines outside the default route.

- [ ] Current production dependency audit findings are listed by affected runtime path and practical exposure.
- [ ] Findings are fixed, removed, or accepted with a recorded reason before release.
- [ ] React Flow and Excalidraw license use is verified for the public repository.
- [ ] tldraw is not added as a shipped dependency.
- [ ] The release check fails when an unreviewed high severity production finding is present.

## Verify the complete React Flow review flow

**What to build:** Prove the complete default canvas workflow with the 50 screen pressure board and make the result the release gate for this slice.

**Blocked by:** Save and reset boards safely; Complete the keyboard review workflow; Keep optional engines outside the default route; Prepare the dependency tree for release.

- [ ] One Chromium workflow loads 50 mixed size screens through the host boundary.
- [ ] The workflow covers selection, move, resize, pan, zoom, point comments, circles, instruction editing, deletion, persistence, live mode, refresh, stale feedback, and review batch export.
- [ ] Annotation drift remains within 2 CSS pixels after geometry and camera changes.
- [ ] The workflow has no uncaught page errors or unexpected console errors.
- [ ] Model, host boundary, live message, production build, bundle, dependency, and browser checks all pass through `npm run verify`.
