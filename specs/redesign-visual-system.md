---
title: Rebuild the canvas visuals and layout on the designmode DLS
status: approved
---

## Problem Statement

The canvas works but looks and behaves like scaffolding. The token seam in `src/app/app.css` covers color, two radii, and one shadow; spacing and type sizes are magic numbers scattered through component CSS; there is no dark theme. Layout is a fixed pixel grid: a 56px toolbar band, a 32px status band, a 300px context pane, a 320px comments panel. Comments live in a side panel away from their marks, and agent activity floats over the canvas ad hoc. A tool whose job is design judgment has to carry its own design judgment.

An earlier draft of this spec proposed resizable docked panels. The handed-off DLS (`design/HANDOFF.md`) supersedes that: nothing docks; all chrome floats as islands over an edge-to-edge canvas.

## Solution

Adopt the design language system in `design/` as the single visual source and land it in two separately verifiable phases. The DLS token set is a strict superset of the existing seam: `--ink`, `--surface`, `--canvas`, `--border`, `--accent`, `--mark`, `--danger*`, `--warn*`, `--ok*`, `--info*`, `--radius-control`, `--radius-panel`, `--shadow-panel` keep their names and meaning; the DLS adds the spacing scale, the type scale, motion tokens, sub-roles, and the `[data-theme="dark"]` block.

### Phase 1: re-skin (issues 01–04)

- Replace the `:root` block in `src/app/app.css` with the DLS token set from `design/tokens/tokens.css`; add the dark theme block and a theme toggle persisted alongside the existing collapsed-panel state.
- Sweep every component CSS file onto the spacing and type tokens: no literal font size, spacing value, or one-off hex remains outside the token block.
- Restyle each existing component in isolation against the DLS classes in `design/components/catalog.md`: toolbar, comments panel, instruction editor, context pane, activity rail rows, project picker, live frame chrome, reset dialog, status bar, frame and mark treatments.
- Redraw the inline SVG icons to the DLS stroke style.
- Enforce the hue jobs: violet for the tool signal, coral for annotations, green for runs; no hue does double duty.

### Phase 2: restructure (issues 05–10)

- Replace the fixed bands and docked panels with the islands layout: toolbar and status as thin floating strips (`.dm-island` + `.dm-toolbar` / `.dm-status-island`), layers-and-aspects and runs as summoned islands, over a full-viewport dot-grid canvas.
- Dodge-by-default placement: a summoned island places itself so it never covers the current selection. Drag-to-reposition wins: a dragged island holds its position for the rest of the session and stops auto-dodging until deselected and reselected.
- The layers-and-aspects island holds a layers tree (selection synced both ways with the canvas, hover-to-outline) and, for the current selection, CSS-speaking aspects sections in stable order: Layout, Flex, Radius, Fill (swatch plus named token), Border, Type. Empty selection shows board-level properties.
- The runs island lists active and recent agent runs (presence dot, activity line, mono run id, expandable output tail) and is present only while runs exist.
- Comment threads move from the panel-bound list onto the canvas as bloom threads anchored at their marks (`.dm-bloom`); a jump-list rail remains as a secondary way to reach a thread, never the primary one.

## Constraints

- Zero new runtime dependencies; the React Flow route gzip budget (`npm run measure`, reference × 1.2) holds; Excalidraw stays lazy-loaded.
- The `ready-ms` first-render bound holds.
- Every `data-testid` and ARIA role and name is preserved; the review contract, host API, and agent adapters are untouched.
- React Flow is styled only through its CSS variables and class overrides; no fork of its `dist/style.css`.
- Both themes pass WCAG AA on body text and all controls, checked against every ground each sits on.

## Acceptance

- [ ] `npm run verify` passes with no test edits beyond additions.
- [ ] No literal font-size, spacing, or color values outside the token block (checked by grep in review).
- [ ] Both themes pass WCAG AA on body text and controls.
- [ ] Bundle gate and `ready-ms` assertions pass.
- [ ] No panel is permanently docked; selecting an element summons the relevant island without covering the selection; a dragged island holds its position across further selections in the same session.
- [ ] A bloomed thread opens at its mark and matches the anchor and state-dot vocabulary in `design/components/catalog.md`.
- [ ] Playwright covers: island drag persists across a new selection with no snap-back; dodge places an island sensibly for a centered selection, never off-canvas.
- [ ] Before-and-after captures of the five main surfaces (picker, board, annotation editing, live view, dispatch) reviewed side by side on the canvas itself.
