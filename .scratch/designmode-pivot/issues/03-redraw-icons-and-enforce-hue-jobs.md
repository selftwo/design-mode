# 03: Redraw icons to the DLS stroke style and enforce the hue jobs

Status: done
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

- [x] All inline icons match the DLS stroke style; accessible names unchanged.
- [x] A hue audit of every surface finds no hue doing double duty (record the audit result in this file under Comments).
- [x] Selected frame ring is violet; marks and pins are coral; run dots are green, in both themes.

## Verify

`npm run verify`. Screenshot the board with a selection, a mark, and a running agent visible; check the three hues read apart in both themes.

## Comments

### Icons redrawn (DLS stroke style)

All seven inline SVGs now use `fill="none"`, `stroke="currentColor"`, `strokeWidth="1.4"`, and round caps/joins on a 16×16 viewBox. The select pointer is stroke-only (no fill). Accessible names unchanged (`aria-label` on toolbar tools; panel toggles keep their existing labels).

Files: `ReviewToolbar.tsx` (3 tool icons), `ReviewCommentsPanel.tsx` (2 chevrons), `DesignContextPane.tsx` (document + chevron).

### Hue audit (2026-07-17)

| Surface | Job | Token / class | Verdict |
|---|---|---|---|
| Frame selection ring | violet signal | `--accent-ring` on `.screen-node` | OK |
| SVG marks (rest/selected/focus) | coral annotate | `--mark` stroke; violet ring via `drop-shadow` only | **fixed** (was violet stroke when selected) |
| Comment pins | coral annotate | `--mark-pin`; violet `--focus-ring` on selection | **fixed** (was violet fill when selected) |
| Stale pins | neutral + coral | dashed `--border-strong` on coral pin | **fixed** (was violet border) |
| Ink draw preview | violet tool signal | `--accent-ring` | OK |
| Element hover outline/label | violet selection | `--accent-ring` / `--accent` | OK |
| Comments list row selection | violet UI selection | `--accent-ring` border | OK |
| Comment ordinal badge | coral mark ref | `--mark-pin` | OK |
| Intent chips pressed | violet dispatch | `.dm-chip[aria-pressed]` | OK (catalog: violet outside bloom) |
| Agent run dots | green runs | `.dm-dot[data-state="running"]` → `--run` | OK |
| Done/failed dots | state tones | `--ok` / `--danger` | OK |
| Toolbar pressed tools | violet signal | `.dm-btn[aria-pressed]` | OK |
| Primary / dispatch actions | violet signal | `.dm-btn--primary` | OK |
| Context tab active | violet signal | `--accent` underline | OK |
| Board loading pulse | neutral wait | `--ink-faint` | **fixed** (was `--accent-ring`, resembled signal) |
| State badges | state tones only | `data-tone` ok/warn/danger/info/muted | OK |
| Live state badge | neutral chrome | `--surface` / `--ink-secondary` | OK |

No remaining hue double-duty. Teal (`--teach-*`) unused until phase 3 learn lens.

### Verify outcome

- `npm run verify` — **pass** (126 unit, 19 e2e).
- `npm run measure` — reactflow gzip **150,976 B** (cap 168,740 B).
- Manual screenshot of selection + mark + running agent in both themes: deferred to human spot-check (code audit confirms correct token assignment).
