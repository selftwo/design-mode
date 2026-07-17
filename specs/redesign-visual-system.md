---
title: Redesign the canvas visual system on a token-complete design language
status: draft
---

## Problem Statement

The canvas works but looks like scaffolding. The token seam in `src/app/app.css` covers color, two radii, and one shadow; spacing and type sizes are magic numbers scattered through component CSS, layout is a fixed pixel grid (56px header, 32px status bar, 300px and 320px panels), notifications pile up as ad-hoc banners, agent activity floats over the canvas, and there is no dark theme. A tool people stare at for hours, whose job is design judgment, has to carry its own design judgment.

## Solution

Adopt the design language system authored at `claude-design/dls/designmode/` as the single visual source. The DLS is a strict superset of the existing `:root` seam: it keeps the current variable names (`--ink`, `--surface`, `--accent`, `--mark`, `--danger*`, `--ok*`, `--info*`, `--radius-*`, `--shadow-panel`) and adds the missing systems: a spacing scale, a type scale, motion tokens, and a `[data-theme="dark"]` theme. The redesign lands in two phases so each is separately verifiable.

### Phase 1: re-skin

- Replace the `:root` block in `src/app/app.css` with the DLS token set; add the dark theme block and a theme toggle persisted alongside the existing collapsed-panel state.
- Sweep every component CSS file to consume spacing and type tokens; no literal px font sizes or one-off hex values remain outside the token block.
- Restyle each presentational component in isolation against the DLS component classes: toolbar, comments panel, instruction editor, context pane, activity rail rows, project picker, live frame chrome, reset dialog, status bar.
- Redraw the inline SVG icons to the DLS stroke style.
- Every `data-testid` and ARIA role/name is preserved; the e2e suite passes unchanged.

### Phase 2: restructure

- Fluid layout: the app shell grid gains resizable panels (pointer-drag splitters with keyboard equivalents) replacing fixed 300px and 320px widths; panel sizes persist per board.
- One notice system: a single component renders all banners (info, warn, error, success) with consistent placement, dismissal, and an action slot, replacing the fixed toast stack.
- Agent activity docks into the shell (collapsible rail) instead of floating over the canvas.
- Modality is consistent: anything blocking uses the native dialog pattern the reset dialog already uses; everything else is inline.
- Motion follows the DLS: one settle per surface change, reduced motion honored, nothing loops.

## Constraints

- Zero new runtime dependencies. The React Flow route gzip budget (`scripts/testing/canvas-bundle-policy.mjs`, reference plus 20 percent) holds.
- The `ready-ms` first-render measurement stays within its asserted bound.
- The review contract, host API, and agent adapters are untouched.
- React Flow vendor styling is bridged through its CSS variables and class overrides only; no fork of `dist/style.css`.

## Acceptance

- [ ] `npm run verify` passes with no test edits beyond additions.
- [ ] No literal font-size, spacing, or color values outside the token block (checked by grep in review).
- [ ] Both themes pass WCAG AA on body text and controls.
- [ ] Bundle gate and `ready-ms` assertions pass.
- [ ] Before and after captures of the five main surfaces (picker, board, annotation editing, live view, dispatch) reviewed on the canvas itself.
