# 01: Adopt the DLS token set and the dark theme toggle

Status: open
Type: task
Phase: 1 (re-skin)
Blocked by: none
Spec: specs/redesign-visual-system.md

Read first: design/tokens/tokens.css (all of it, comments included), the token-contract paragraph in design/HANDOFF.md.

## What to build

Replace the `:root` block in `src/app/app.css` with the DLS token set from `design/tokens/tokens.css`, including the `[data-theme="dark"]` block. The DLS is a strict superset of the current seam: `--ink`, `--surface`, `--canvas`, `--border`, `--accent`, `--mark`, `--danger*`, `--warn*`, `--ok*`, `--info*`, `--radius-control`, `--radius-panel`, `--shadow-panel` keep their names and meaning, so existing component CSS keeps rendering. Do not restyle components in this ticket.

Add a theme toggle: set `data-theme` on the document root, default light, persisted alongside the existing collapsed-panel state (see `src/features/review-board/use-collapsed-panel-state.ts` for the persistence pattern). A minimal toggle control in the toolbar is enough for now; it gets its final placement later.

## Done when

- [ ] `src/app/app.css` `:root` is the DLS token set verbatim (values, not a paraphrase); the dark block is present.
- [ ] Every existing surface still renders correctly on the new tokens in light theme.
- [ ] Toggling to dark restyles the chrome; the choice survives reload.
- [ ] No `data-testid` or ARIA role/name changed.

## Verify

`npm run verify`. Then load the pressure board and flip themes: no unreadable text, no vanished borders in either theme.
