# 01: Adopt the DLS token set and the dark theme toggle

Status: done
Type: task
Phase: 1 (re-skin)
Blocked by: none
Spec: specs/redesign-visual-system.md

Read first: design/tokens/tokens.css (all of it, comments included), the token-contract paragraph in design/HANDOFF.md.

## What to build

Replace the `:root` block in `src/app/app.css` with the DLS token set from `design/tokens/tokens.css`, including the `[data-theme="dark"]` block. The DLS is a strict superset of the current seam: `--ink`, `--surface`, `--canvas`, `--border`, `--accent`, `--mark`, `--danger*`, `--warn*`, `--ok*`, `--info*`, `--radius-control`, `--radius-panel`, `--shadow-panel` keep their names and meaning, so existing component CSS keeps rendering. Do not restyle components in this ticket.

Add a theme toggle: set `data-theme` on the document root, default light, persisted alongside the existing collapsed-panel state (see `src/features/review-board/use-collapsed-panel-state.ts` for the persistence pattern). A minimal toggle control in the toolbar is enough for now; it gets its final placement later.

## Done when

- [x] `src/app/app.css` `:root` is the DLS token set verbatim (values, not a paraphrase); the dark block is present.
- [x] Every existing surface still renders correctly on the new tokens in light theme.
- [x] Toggling to dark restyles the chrome; the choice survives reload.
- [x] No `data-testid` or ARIA role/name changed.

## Verify

`npm run verify`. Then load the pressure board and flip themes: no unreadable text, no vanished borders in either theme.

## Comments

- Replaced `src/app/app.css` `:root` with verbatim DLS tokens from `design/tokens/tokens.css` (light block, dark `[data-theme="dark"]` block, typography/spacing/motion `:root`, reduced-motion contract).
- Added `src/features/review-board/use-theme-state.ts` (+ unit tests): persists `design-review-theme` in localStorage, applies `data-theme` on `document.documentElement`.
- `src/app/main.tsx` applies stored theme before React render to avoid flash.
- `ReviewToolbar` ships minimal `data-testid="theme-toggle"` button (`aria-pressed` reflects dark mode).
- `npm run verify` — **pass** (126 unit tests, 19 e2e, build OK).
- `npm run measure` — reactflow gzip **148,346 B** (cap 168,740 B).
