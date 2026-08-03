# 07: Finish the reskin — dark-theme literals, FOUC, one AA failure, motion and token nits

Status: done
Type: task
Severity: medium (phase-1 "done when" not actually met)

## Defects

1. **Theme-hostile literals in `src/app/app.css`** (pre-existing lines the sweep skipped, now visibly broken because a dark theme exists): `#eef1f5` engine badge/switcher grounds (lines 167, 177), `#f7f9fc`/`#98a4b5` button hover (39-40), `#fff` pressed text (51), `#e4e7ec`/`#f2f4f7` disabled fills (64-65), `#fff` at 189, plus ~9 literal font sizes and radii through lines 280-402. In dark theme the switcher stays light while `--ink-muted` flips light: the "Excalidraw" label in visual-proof/after/02 sits at roughly 2.5:1. Sweep onto `--surface-sunken`, `--surface-hover`, `--border-strong`, `--ink-faint`, `--accent-ink`, and the type scale.
2. **AA failure:** `ReviewCommentsPanel.css:126-127` `.comment-ordinal { background: var(--mark); color: var(--accent-ink); }` — white on `--mark` is 3.79:1. The DLS token for solid pins is `--mark-pin` (5.13:1 light / 4.55:1 dark). One-token fix; also resolves the cross-family use of `--accent-ink` on a coral fill.
3. **Undefined token:** `ReviewCommentsPanel.css:129` uses `var(--weight-bold)`; tokens stop at `--weight-semibold`. Silently renders inherited weight.
4. **Dark FOUC:** `applyDocumentTheme(readStoredTheme())` runs at bundle evaluation. Move the theme read into a tiny inline script in the `<head>` of `index.html` and `m-web.html` so a dark-theme reviewer never gets the light flash.
5. **Motion bug:** `LiveReviewFrame.css:28` runs the connecting pulse at `var(--duration-settle)` (220ms) infinite with a raw `ease-in-out` — a fast flicker. `design/screens/live-view.html:182` says the connecting chip pulses once; the same keyframe elsewhere uses 1.6s. Fix duration/curve, prefer pulse-once.
6. **Token nits in new files:** `LayersAndAspectsIsland.css:102` `font-size: 11px` → `var(--text-2xs)`; `m-web.css:458` `padding: 16px` → `var(--space-4)`.
7. **Bookkeeping:** record in `DECISIONS.md` the removed `toggle-context-pane` testid and the `"Agent activity"` → `"Agent runs"` aria-label rename (screen file wins; both intentional, neither referenced by e2e — but the pivot constraint said preserved, so the deviation must be on the record). Also restore the missing `## date: title` headings on the four DECISIONS.md entries that currently run together as bare `Status: Accepted` paragraphs (bloom threads, learn lens, teach annotations, theme toggle).

## Done when

- [x] No literal color, font size, or spacing value in `src/app/app.css` outside comments; both themes visually checked on the engine switcher, disabled buttons, and hover states.
- [x] All AA pairs pass both themes (`scripts/testing/verify-token-contrast-pairs.mjs` extended to cover `.comment-ordinal`).
- [x] No `var(--…)` in `src/**/*.css` references an undefined token (add a check script or grep to `check:repo` if cheap).
- [x] No light flash loading either entry with dark theme persisted.
- [x] Connecting pulse matches the live-view screen.
- [x] DECISIONS.md entries repaired and additions recorded.

## Verify

`npm run verify`. Screenshot both themes of the toolbar and live-frame connecting state.

## Comments

Replaced theme-hostile literals, fixed ordinal contrast and weight, added head theme bootstraps, and changed connecting motion to a single settled pulse. Existing contract migrations are recorded in `DECISIONS.md`.
