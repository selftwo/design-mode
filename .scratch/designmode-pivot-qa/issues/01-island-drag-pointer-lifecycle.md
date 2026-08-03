# 01: Island drag end throws and leaks a live pointermove handler

Status: done
Type: task
Severity: high (confirmed by code reading)

## Defect

`src/features/review-board/SummonedIsland.tsx:121-129` (duplicated in `LearnLensIsland.tsx:124-132`): `handleUp` runs as a native `pointerup` listener but dereferences the React synthetic event's `event.currentTarget`, which React DOM nulls after the `pointerdown` dispatch finishes.

Failure scenario: drag any island header (layers/aspects, runs, comments rail, learn lens) and release. `setDragging(false)` runs, then `event.currentTarget.removeEventListener(...)` throws `TypeError`, so the `pointermove` listener is never removed. The closure's `moved` flag stays `true`, so every later pointer movement over that header — no button pressed — calls `placeAt(...)`: the island jumps to and follows the cursor on mere hover. Listeners accumulate per drag. The drag-persist e2e passes only because Playwright never re-hovers the header after release.

## Fix

Capture the header element into a local (`const header = event.currentTarget` inside `handlePointerDown`, before any async use) and register/remove all native listeners on that local. Reset `moved` on up. Consider `releasePointerCapture` symmetry. Apply the same fix to both files, or extract the shared drag hook (feature-owned, no utils folder — it can live beside `SummonedIsland`).

## Done when

- [x] Releasing a drag removes the pointermove listener and throws nothing (assert no page errors in the e2e).
- [x] After a drag, hovering the header without a pressed button does not move the island.
- [x] Repeated drags do not accumulate listeners.
- [x] New Playwright step in `react-flow-island-drag-persist.spec.ts`: after drag release, hover across the header and assert the island position is unchanged; fail the test on any `pageerror`.

## Verify

`npm run verify`.

## Comments

- Extracted `useIslandHeaderDrag.ts`; captures header element before React nulls synthetic `currentTarget`; resets `moved` on up; symmetric `releasePointerCapture`.
- Extended `react-flow-island-drag-persist.spec.ts` first test with post-release hover + `pageerror` guard.
