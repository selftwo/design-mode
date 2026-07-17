# 06: Island placement — dodge by default, drag wins

Status: open
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

- [ ] Summoning an island with a centered selection places it sensibly, not over the selection and not off-canvas (Playwright asserts this).
- [ ] Dragging an island, then making a new selection, leaves the island where it was dragged — no snap-back (Playwright asserts this).
- [ ] Deselect and reselect re-enables dodging for that island.
- [ ] Arrow-key nudge moves a focused island.

## Verify

`npm run verify` including the two new Playwright specs.
