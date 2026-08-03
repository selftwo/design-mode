# 13: Phase 3 gate — verify the differentiators

Status: done
Type: task
Phase: 3 (differentiators)
Blocked by: 12
Spec: specs/learn-lens-teach-annotations.md

## What to do

Run the phase 3 done-when from design/HANDOFF.md and record the evidence.

- The learn lens opens on demand, is fully draggable and closable, updates content on each new element click without moving itself.
- A question asked inside it produces a teach annotation on the canvas when the reviewer chooses to pin it.
- The dark theme is a first-class, user-facing toggle (finish its placement and polish if 01 only scaffolded it).
- Hue audit still holds: teal appears nowhere except teach material.

## Done when

- [x] `npm run verify` passes, including the 11 and 12 Playwright additions.
- [x] Bundle cap and `ready-ms` hold (the lens and teach plumbing added no runtime dependency and no bundle regression).
- [x] Theme toggle reviewed as a user-facing control in both themes.
- [x] Evidence recorded under Comments; deviations from the screens recorded in DECISIONS.md.

## Verify

This ticket is the verification. Fix regressions in place or reopen 11–12.

## Comments

### `npm run verify`

- **Pass** — 151 unit tests, 27 e2e (2026-07-17 gate run).
- No test edits during gate; tickets 11–12 Playwright additions all green.

### Bundle and `ready-ms`

| Metric | Phase 2 gate | Ticket 11 | Ticket 12 | Gate run | Cap / bound |
|--------|--------------|-----------|-----------|----------|-------------|
| React Flow route gzip | 158,551 B | 161,564 B | 163,468 B | **163,468 B** | 168,740 B |
| `ready-ms` (pressure board e2e) | 243 ms | — | — | **212 ms** | holds (`.canvas-results/reactflow-runtime.json`) |

Phase 3 added ~4.9 KB gzip over phase 2; still 5.3 KB under cap. Zero new runtime dependencies (`check:dependencies` pass).

### Playwright phase 3 coverage (tickets 11 + 12)

| Spec | Result |
|------|--------|
| `react-flow-learn-lens.spec.ts` | pass — open lens, drag, second element updates content, position holds; close from toolbar and header |
| `react-flow-teach-annotation.spec.ts` | pass — ask in lens, pin, teal `.dm-teach-note` with `⌁` glyph on canvas |

### Phase 3 done-when spot-check

| Criterion | Checked | Result |
|-----------|---------|--------|
| Learn lens on demand | `tool-learn` summons island | pass |
| Draggable / closable | e2e drag + `learn-lens-close` | pass |
| Content updates in place | e2e second element pick; position delta &lt; 2 px | pass |
| Question → teach pin | e2e pin flow; `build-teach-annotation.test.ts` | pass |
| Teach excluded from dispatch | `review-batch.test.ts` | pass |
| Staleness on refresh | `board-document.test.ts` teach variant | pass |
| Dark theme first-class | toolbar `theme-toggle` in both themes; `use-theme-state.test.ts` | pass |

### Theme toggle review (both themes)

Captured `04-theme-toggle.png` in `.scratch/designmode-pivot/gate-13-evidence/{light,dark}/`.

- **Placement:** toolbar actions group, before Import — reachable on every board surface.
- **Contract:** `data-testid="theme-toggle"`, `aria-pressed` reflects dark mode, label switches Dark/Light.
- **Persistence:** `design-review-theme` in localStorage; `data-theme` on `document.documentElement`.
- **Polish:** quiet `dm-btn--sm` styling; no hue-job bleed (violet signal only on pressed tools).

### Hue audit — teal only on teach material (2026-07-17)

| Surface | Job | Token / class | Verdict |
|---------|-----|---------------|---------|
| Learn lens island | teal teach | `.dm-learn`, `LearnLensIsland.css` → `--teach-*` | OK |
| Learn lens ask form | teal teach | `--teach-border`, `--teach-well`, `--teach-ink`, `--teach-surface` | OK |
| Teach note on canvas | teal teach | `.dm-teach-note`, `.dm-teach-chip`, `.dm-teach-stem` | OK |
| Jump-list teach rows | teal teach | `.comment-item--teach`, `.comment-chip.teach` | OK |
| Frame selection / marks | violet / coral | no `--teach-*` | OK |
| Runs island | green runs | no `--teach-*` | OK |
| Toolbar / status | violet signal / neutral | no `--teach-*` | OK |

`rg '--teach-' src --glob '*.css'` hits only `LearnLensIsland.css`, `TeachAnnotationNote.css`, `ReviewCommentsPanel.css` (teach jump-list styling). No hue double-duty.

Prior phase 1–2 hue jobs (violet signal, coral marks, green runs) unchanged; spot-check via ticket 03 audit table still holds.

### WCAG AA (both themes)

Re-ran `scripts/testing/verify-token-contrast-pairs.mjs`: **38 pairs, all ≥ 4.5:1** (matrix in `.scratch/designmode-pivot/gate-04-evidence/contrast-pairs.json`). Teach surfaces pair `--teach-ink` / `--ink-muted` on `--teach-surface` / `--teach-well` as annotated in `design/tokens/tokens.css`.

### Screen comparison (both themes)

Captured at 1280×720 with `scripts/testing/capture-phase3-gate-surfaces.mjs`:

- `.scratch/designmode-pivot/gate-13-evidence/light/*.png`
- `.scratch/designmode-pivot/gate-13-evidence/dark/*.png`
- `.scratch/designmode-pivot/gate-13-evidence/verdict.json`

| Screen spec | Verdict |
|-------------|---------|
| `learn-lens.html` | **pass** — teal floating lens, anatomy/term/why, ask form + inline answer non-actionable, pinned status line |
| Teach note on canvas | **pass** (e2e + capture) — `.dm-teach-note` with `⌁ teach` chip; screen’s `✦` glyph superseded by `⌁` per HANDOFF |
| Theme toggle | **pass** — first-class toolbar control; screen HTML omits it (see DECISIONS) |

### Tickets 11–12 spot-check

| Ticket | Spot-check |
|--------|------------|
| 11 | `LearnLensIsland` draggable/closable; `derive-learn-content`; host `POST …/teach`; teal-only lens CSS |
| 12 | `kind: 'teach'` schema; pin from lens; layers tree + jump list; reload persistence; no dispatch export |

### Phase gate

**Phase 3 (differentiators) is closed.** Phase 4 may start at ticket 14 (`14-m-web-read-and-reply.md`).
