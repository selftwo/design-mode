# 06: Island placement — dodge by default, drag wins

Status: done
Type: task
Phase: 2 (restructure)
Blocked by: 05
Spec: specs/redesign-visual-system.md

Read first: the interaction rules in design/HANDOFF.md; the Island row of design/components/catalog.md (`--summoned`, `[data-open]`, `[data-dragging="true"]`).

## What to build

A shared placement mechanism for summoned islands, under `src/features/review-board/` (name files after the work, for example `island-placement.ts` with tests beside it). Behavior:

- **Dodge by default.** A summoned island places itself so it never covers the current selection's screen bounds, preferring the side opposite the selection, and never off-canvas.
- **Drag wins.** Islands drag by their head (`.dm-island-head` grip). Once dragged, the island's position holds for the rest of the session across further selections, and dodging stops for that island until it is deselected and reselected (or closed and re-summoned).
- **Keyboard.** A focused island can be nudged with arrow keys (the learn lens will rely on this in phase 3).
- Entrances use the summoned settle; `[data-dragging="true"]` kills transitions mid-drag.

Pure placement math gets unit tests; behavior gets Playwright coverage.

## Done when

- [x] Summoning an island with a centered selection places it sensibly, not over the selection and not off-canvas (Playwright asserts this).
- [x] Dragging an island, then making a new selection, leaves the island where it was dragged — no snap-back (Playwright asserts this).
- [x] Deselect and reselect re-enables dodging for that island.
- [x] Arrow-key nudge moves a focused island.

## Comments

- **`src/features/review-board/island-placement.ts`** (+ test): pure dodge math — opposite-side default, roomier side for centered selections, overlap avoidance, viewport clamp.
- **`src/features/review-board/read-selection-bounds.ts`**: reads selection screen bounds from `[data-annotation-id]` or `[data-testid="frame-…"]`.
- **`src/features/review-board/SummonedIsland.tsx`** (+ CSS): shared summoned shell — `dm-island--summoned` settle, `[data-dragging="true"]` kills transitions, head drag, arrow-key nudge (Shift = coarse), session `userPlaced` cleared when `data-open` goes false.
- **`src/features/review-board/SelectionInspectorIsland.tsx`**: minimal summoned probe wired in `App.tsx` on frame/annotation selection; ticket 07 replaces its body with layers+aspects.
- **`e2e/review-board/react-flow-island-dodge.spec.ts`**: centered element pick → island avoids selection and stays on canvas.
- **`e2e/review-board/react-flow-island-drag-persist.spec.ts`**: drag persists across selection change; deselect/reselect re-dodges; arrow-key nudge.
- `npm run verify` — **pass** (132 unit, 23 e2e).
- `npm run measure` — reactflow gzip **152,613 B** (cap 168,740 B).

`npm run verify` including the two new Playwright specs.
