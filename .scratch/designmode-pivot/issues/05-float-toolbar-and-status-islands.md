# 05: Float the toolbar and status strip as islands over an edge-to-edge canvas

Status: done
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

- [x] No fixed header or status band; the canvas fills the viewport behind floating chrome.
- [x] Toolbar and status render as islands matching the catalog rows, both themes.
- [x] All existing toolbar and status functionality still works; e2e passes without edits.

## Comments

### Verify — 2026-07-17

`npm run verify` **pass** (126 unit, 19 e2e).

| Check | Result |
|-------|--------|
| gzip (reactflow route) | 150,937 B (cap 168,740 B) |
| ready-ms | unchanged contract via `[data-testid="ready-ms"]` in status island |

### Changes

- **`src/app/app.css`:** Removed shell grid rows for toolbar/status bands; `.canvas-region` is `inset: 0` edge-to-edge. Added `.toolbar-island` (fixed top-center) and `.board-status` as `.dm-island.dm-status-island` (fixed bottom-left). Status banners offset below floating toolbar. Mobile wrap/position at 640px matches `design/screens/board.html`.
- **`src/app/App.tsx`:** Canvas region renders first (full viewport); toolbar and status islands float over it. Status rebuilt as one mono line with `·` separators; added zoom (`board-zoom`); preserved every `data-testid` and `focus-state` wording.
- **`src/features/review-board/ReviewToolbar.tsx`:** `.dm-island.dm-toolbar` floating island; icon tools → word buttons (Select/Circle/Comment) + disabled Learn placeholder; Import/Live with live-dot; all testids and `aria-label` names preserved.
- **`src/features/local-host/AgentActivityRail.css`:** Moved runs rail to bottom-right to clear the status island.

### Manual spot-check

Pressure board (50 screens): pan and zoom work under floating toolbar and status island; context/comments panels remain docked on sides.

## Verify

`npm run verify`. Load the pressure board: pan and zoom under the islands; nothing docks edge to edge.
