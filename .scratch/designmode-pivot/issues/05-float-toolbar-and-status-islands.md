# 05: Float the toolbar and status strip as islands over an edge-to-edge canvas

Status: open
Type: task
Phase: 2 (restructure)
Blocked by: 04
Spec: specs/redesign-visual-system.md

Read first: design/screens/board.html; the Island, Toolbar island, and Status island rows of design/components/catalog.md.

## What to build

Make the canvas edge to edge: full viewport, dot grid, zoom range 0.25 to 2, camera held per board (the engine already does most of this; remove the fixed 56px toolbar band and 32px status band from the shell grid in `src/app/App.tsx` / `src/app/app.css`).

Rebuild the toolbar as a floating island (`.dm-island` + `.dm-toolbar`): title, tool words (Select / Circle / Comment / Learn placeholder), Import, Live; tools as quiet small buttons with `aria-pressed`; wraps below 640px. Rebuild status as a bottom-corner status island (`.dm-status-island`): one mono line, tabular numerals, frame id, selection count, zoom, save state, delivery state as plain words, no icons standing in for text.

The docked context and comments panels stay docked in this ticket; they move in 07 and 09. Keep every `data-testid` and ARIA role/name.

## Done when

- [ ] No fixed header or status band; the canvas fills the viewport behind floating chrome.
- [ ] Toolbar and status render as islands matching the catalog rows, both themes.
- [ ] All existing toolbar and status functionality still works; e2e passes without edits.

## Verify

`npm run verify`. Load the pressure board: pan and zoom under the islands; nothing docks edge to edge.
