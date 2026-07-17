# 03: Redraw icons to the DLS stroke style and enforce the hue jobs

Status: open
Type: task
Phase: 1 (re-skin)
Blocked by: 02
Spec: specs/redesign-visual-system.md

Read first: the "one hue, one job" rule in design/HANDOFF.md; the hue-job column of design/components/catalog.md; the icon treatments visible in design/screens/board.html.

## What to build

Redraw every inline SVG icon in the app (toolbar tools, panel controls, dismiss and action glyphs) to the DLS stroke style used in the screen specs. Keep each icon's accessible name.

Then audit the whole app for hue-job violations and fix them:

- Violet only for the tool's own signal: selection, pressed state, focus ring, active tool, primary/dispatch actions.
- Coral only for review annotations: marks, pins, thread paper, mark references.
- Green only for run states: dots and run words. Violet never marks a run.
- No other color use outside the state tones (`--danger*`, `--warn*`, `--ok*`, `--info*`) in their notice/badge roles.

## Done when

- [ ] All inline icons match the DLS stroke style; accessible names unchanged.
- [ ] A hue audit of every surface finds no hue doing double duty (record the audit result in this file under Comments).
- [ ] Selected frame ring is violet; marks and pins are coral; run dots are green, in both themes.

## Verify

`npm run verify`. Screenshot the board with a selection, a mark, and a running agent visible; check the three hues read apart in both themes.
