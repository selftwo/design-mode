# 03: Stale annotations cannot be edited or deleted, and an incomplete stale draft blocks export forever

Status: done
Type: task
Severity: high (workflow dead end)

## Defect

The instruction editor (with the only Delete button) left `ReviewCommentsPanel` when the rail became a jump list, and `AnnotationBloom.tsx:271-272` renders a read-only `StaleThreadBody` whenever `isAnnotationStale` is true — no editor, no delete, Resolve hidden (`:299`). React Flow `deleteKeyCode={null}` removes the keyboard path too.

Failure scenario: create a mark, leave the instruction empty, an agent run triggers a capture refresh that bumps the frame revision. The annotation is now stale + incomplete; `collectReviewBatchBlocks` blocks every export; the "Fix N annotations" banner jumps to a bloom that offers no way to fix or remove it. Only a full board reset recovers.

Note: ticket 09 of the pivot checked "editing, intent chips, delete, and reply all work inside the bloom" — that acceptance is not actually met for stale threads.

## Fix

Stale threads keep the neutral stale treatment (never alarmist red) but stay actionable: show the instruction editor (or at minimum Delete and Resolve) inside the stale bloom. `design/HANDOFF.md` stale handling only demands the stale flip on mark and chip; it does not require read-only. Alternatively (weaker): exclude stale-incomplete annotations from export blocking. Prefer the editable bloom.

## Done when

- [x] A stale annotation can be deleted from its bloom.
- [x] A stale annotation's instruction can be completed, unblocking export.
- [x] Unit test on the blocking path + Playwright: force staleness via capture-refresh fixture, then delete from the bloom and export successfully.

## Verify

`npm run verify`.

## Comments

- Removed read-only `StaleThreadBody`; stale blooms use `AnnotationInstructionEditor` with neutral stale badge; Resolve shown when not resolved.
- Added `e2e/review-board/react-flow-stale-annotation-recovery.spec.ts` with pre-stale board fixture.
