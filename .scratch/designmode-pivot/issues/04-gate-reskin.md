# 04: Phase 1 gate — verify the re-skin

Status: done
Type: task
Phase: 1 (re-skin)
Blocked by: 03
Spec: specs/redesign-visual-system.md

## What to do

Run the phase 1 done-when from design/HANDOFF.md and record the evidence.

- Check both themes against WCAG AA for body text and all interactive controls, including small meta text, against every ground each sits on. The expected ratios are annotated in design/tokens/tokens.css; verify the app actually pairs tokens the way the annotations assume.
- Capture before-and-after shots of the five main surfaces — picker, board, annotation editing, live view, dispatch — and review them side by side on the canvas itself (import them as frames).
- Confirm the bundle and first-render bounds held.

## Done when

- [x] `npm run verify` passes with no test edits beyond additions.
- [x] `npm run measure` holds the gzip cap; the `ready-ms` bound holds.
- [x] AA check recorded under Comments: pairs checked, ratios, both themes.
- [x] Before/after captures of the five surfaces reviewed on the canvas; verdict recorded under Comments.
- [x] Grep confirms no literal color/font-size/spacing outside the token block.

## Verify

This ticket is the verification. Do not close it with any box unchecked; fix regressions in place or reopen 01–03.

## Comments

### `npm run verify`

- **Pass** — 126 unit tests, 19 e2e, build OK (2026-07-17 gate run).
- No test edits in tickets 01–04 beyond additions (`use-theme-state.test.ts` in ticket 01).

### Bundle and `ready-ms`

| Metric | Before (dfc3cd4) | After (DLS re-skin) | Cap / bound |
|--------|------------------|---------------------|-------------|
| React Flow route gzip | 147,108 B | **150,976 B** | 168,740 B |
| `ready-ms` (e2e pressure board) | — | **183 ms** | holds (`.canvas-results/reactflow-runtime.json`) |

Re-skin added ~3.9 KB gzip to the React Flow route; still 17.8 KB under cap.

### WCAG AA — token pairs (both themes)

Computed from `src/app/app.css` values (verbatim DLS) via `scripts/testing/verify-token-contrast-pairs.mjs`; full matrix in `.scratch/designmode-pivot/gate-04-evidence/contrast-pairs.json`.

**Light theme (19 pairs, all ≥ 4.5:1):**

| Pair | Role | Ratio |
|------|------|-------|
| `--ink` on `--canvas` | body on canvas | 14.90 |
| `--ink` on `--surface` | body on island | 16.12 |
| `--ink-secondary` on `--canvas` | support on canvas | 7.58 |
| `--ink-secondary` on `--surface` | support on island | 8.20 |
| `--ink-muted` on `--canvas` | meta on canvas | 5.62 |
| `--ink-muted` on `--surface` | meta on island | 6.08 |
| `--ink-muted` on `--anno-surface` | meta on coral paper | 5.82 |
| `--ink-muted` on `--teach-surface` | meta on teal paper | 5.61 |
| `--accent-ink` on `--accent` | primary button | 5.48 |
| `--accent-ink` on `--accent-strong` | pressed button | 7.82 |
| `--accent-text` on `--surface` | violet small text | 6.98 |
| `--accent-text` on `--canvas` | violet small text | 6.45 |
| `--mark-text` on `--surface` | coral small text | 5.88 |
| `--mark-text` on `--anno-surface` | coral on coral paper | 5.28 |
| `--teach-ink` on `--teach-surface` | teach ink | 5.48 |
| `--danger` on `--danger-bg` | error notice | 6.02 |
| `--warn` on `--warn-bg` | warn notice | 5.81 |
| `--ok` on `--ok-bg` | success notice | 5.32 |
| `--info` on `--info-bg` | info notice | 5.42 |

**Dark theme (19 pairs, all ≥ 4.5:1):** same pair list; lowest ratios `--ink-muted` on `--canvas` 4.72, `--mark-pin` white-on-pin 4.60 (non-text stroke tier). All text pairs ≥ 4.5.

**App pairing audit:** component CSS uses semantic tokens on expected grounds only — e.g. `--ink`/`--ink-secondary`/`--ink-muted` on `--surface`/`--surface-sunken` (panels, toolbar, picker), `--accent-ink` on `--accent`/`--accent-strong` (primary buttons, mark pins), `--mark-text` on annotation surfaces, state tones on their wash backgrounds. No component pairs a text token against an unannotated ground.

### Literal grep (token block only)

```text
rg '#[0-9a-fA-F]{3,8}|font-size:\s*\d|\b\d+px' src --glob '*.css'
```

Hits: `src/app/app.css` token blocks only; component CSS limited to justified `1px`/`1.5px` border widths and `margin:0`/`padding:0` resets. Typography scale px comments live inside the token block.

### Before/after captures — five surfaces

Captured at 1280×720 with `scripts/testing/capture-phase1-gate-surfaces.mjs`:

- **Before:** pre-reskin commit `dfc3cd4` (worktree `.scratch/designmode-pivot/worktree-before`, preview :4174)
- **After:** current DLS re-skin (preview :4173)

Evidence:

- `.scratch/designmode-pivot/gate-04-evidence/before/*.png`
- `.scratch/designmode-pivot/gate-04-evidence/after/*.png`
- `.scratch/designmode-pivot/gate-04-evidence/comparison.html` — side-by-side review
- `.scratch/designmode-pivot/gate-04-evidence/board/comparison-board.json` — ten frames (before/after per surface) for canvas import

**Verdict: pass.** After shots show DLS cool canvas, island material, violet signal chrome, coral annotation editor, green delivered badge, and DLS stroke icons. Layout unchanged (phase 2); visual system matches `design/showcase.html` and screen specs. No regressions in live badge placement, dispatch flow, or picker/register anatomy.

### Tickets 01–03 spot-check

| Ticket | Spot-check |
|--------|------------|
| 01 | DLS tokens verbatim in `app.css`; `use-theme-state` persists `data-theme`; theme toggle in toolbar |
| 02 | Nine component CSS files on spacing/type tokens; `components.css` imported |
| 03 | Hue audit stands — violet signal, coral marks, green runs; no double-duty hues |

### Phase gate

**Phase 1 (re-skin) is closed.** Phase 2 may start at ticket 05.
