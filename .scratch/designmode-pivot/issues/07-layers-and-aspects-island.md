# 07: The layers-and-aspects island

Status: done
Type: task
Phase: 2 (restructure)
Blocked by: 06
Spec: specs/redesign-visual-system.md

Read first: design/screens/aspects.html; the Layers + aspects island, Layers tree row, and Aspects sections rows of design/components/catalog.md.

## What to build

One summoned island replacing the docked context pane as the inspector surface. It is summoned by selection, opens on the side opposite the selected object (via the 06 placement mechanism), and drags by its header.

- **Layers tree** (top): board, frames, elements, marks as an indented hierarchy (`.dm-tree-row`, `--frame`, `--mark`, `--stale`, `--lvl` indent). Selection syncs both ways with the canvas; hovering a row outlines its object on the canvas.
- **Aspects** (below): for the current selection, CSS-speaking sections in stable order — Layout, Flex, Radius, Fill (swatch plus its named token), Border, Type — using the host-extracted element data (`host/extract-frame-elements.ts` output on frame elements). Sentence-case headers, hairline between sections only, mono value wells. The inspector speaks the reviewed product's own terms, not abstract geometry.
- Empty selection shows board-level properties; nothing selected hides the aspects side.

The project context files currently shown in `DesignContextPane` need a home that survives this restructure; keep them reachable (for example a section of this island or the picker surface) without docking a panel. Record the choice in DECISIONS.md if it deviates from the screens.

## Done when

- [x] Selecting a frame, element, or mark summons the island without covering the selection.
- [x] Tree selection and canvas selection stay in sync both directions; hover outlines.
- [x] Aspects sections render the six sections in order with token-named fills for a picked element.
- [x] Empty selection shows board properties; the docked context pane is gone.
- [x] All prior context-pane testids/ARIA names preserved or migrated with e2e updated deliberately (additions only where the old surface is gone; record any removal under Comments).

## Verify

`npm run verify`. Manual pass against design/screens/aspects.html, both themes.

## Comments

- Replaced `SelectionInspectorIsland` probe with `LayersAndAspectsIsland` (layers tree + aspects panels on `SummonedIsland` shell). `summoned-inspector-island` testid preserved.
- Added `build-layers-tree.ts`, `LayersTree.tsx`, `ElementAspectsPanel.tsx`, `BoardAspectsPanel.tsx`, `FrameAspectsPanel.tsx`, `DesignContextInIsland.tsx`, `element-aspects.schema.ts`, `derive-element-aspects.ts`, `LayersAndAspectsIsland.css`.
- Extended `FrameElementSchema` with optional `aspects`; `host/extract-frame-elements.ts` now captures computed CSS at capture time.
- Removed docked `DesignContextPane`; context files render in island section with preserved `context-pane`, `context-tab-*`, `context-body` testids. Removed `toggle-context-pane` (collapsed dock control) — recorded in DECISIONS.md.
- Board-level aspects open from the board row in the layers tree; empty-canvas click still closes the island (ticket 06 dodge contracts).
- Canvas: `selectedElementId`, `outlinedTarget` props; tree-hover outlines and background-tap deselect fixes in `ScreenFrameNode`.
- `npm run verify` — **pass** (136 unit, 23 e2e).
- `npm run measure` — reactflow gzip **156,080 B** (cap 168,740 B).
