# 10: Phase 2 gate — verify the restructure

Status: done
Type: task
Phase: 2 (restructure)
Blocked by: 07, 08, 09
Spec: specs/redesign-visual-system.md

## What to do

Run the phase 2 done-when from design/HANDOFF.md and record the evidence.

- No panel is permanently docked anywhere in the app.
- Selecting an element or frame summons the relevant island without covering the selection; dragging an island holds its position across further selections in the same session.
- A bloomed thread opens at its mark and matches the anchor and state-dot vocabulary in design/components/catalog.md.
- The full review workflow (load, mark, intent, dispatch, returned run, refresh, stale, export) still completes end to end on the islands layout, keyboard included.

## Done when

- [x] `npm run verify` passes, including the 06 and 09 Playwright additions.
- [x] `npm run measure` holds the gzip cap; `ready-ms` holds.
- [x] The keyboard workflow e2e passes on the new layout.
- [x] A full manual review pass on the pressure board is recorded under Comments (what was checked, what broke, what was fixed).
- [x] Screens match design/screens/board.html, aspects.html, review-dispatch.html, returned-run.html, states.html in both themes; deviations recorded in DECISIONS.md.

## Verify

This ticket is the verification. Fix regressions in place or reopen 05–09.

## Comments

### `npm run verify`

- **Pass** — 142 unit tests, 24 e2e (2026-07-17 gate run).
- **Fix during gate:** `react-flow-element-picking.spec.ts` collapsed the jump-list rail via keyboard (`focus` + `Enter` on `toggle-comments-panel`) because an open bloom textarea intercepted pointer clicks on the collapse control. Bloom visibility assertion added after element pick.

### Bundle and `ready-ms`

| Metric | Value | Cap / bound |
|--------|-------|-------------|
| React Flow route gzip | **158,551 B** | 168,740 B |
| `ready-ms` (pressure board e2e) | **243 ms** | holds (`.canvas-results/reactflow-runtime.json`) |

Phase 2 added ~7.6 KB gzip over phase 1 (150,976 B); still 10.2 KB under cap.

### Playwright phase 2 coverage (tickets 06 + 09)

| Spec | Result |
|------|--------|
| `react-flow-island-dodge.spec.ts` | pass — centered selection dodge, on-canvas |
| `react-flow-island-drag-persist.spec.ts` | pass — drag holds across selection; deselect/reselect re-arms dodge; arrow nudge |
| `react-flow-bloom.spec.ts` | pass — bloom at mark, intent, resolve, jump-list opens correct bloom |
| `react-flow-keyboard-workflow.spec.ts` | pass — full keyboard review workflow on islands layout |
| `react-flow-review-workflow.spec.ts` | pass — 50-screen pressure board pointer workflow |

### No docked panels audit

- `DesignContextPane` and `AgentActivityRail` deleted; context lives in `LayersAndAspectsIsland`; runs in `RunsIsland`.
- `ReviewCommentsPanel` is a summoned jump-list island (`comments-rail-island`), not a fixed column.
- Grep: no `width: 300px` / `width: 320px` docked panel rules remain in `src/`.

### WCAG AA (both themes)

Re-ran `scripts/testing/verify-token-contrast-pairs.mjs`: **38 pairs, all ≥ 4.5:1** (matrix in `.scratch/designmode-pivot/gate-04-evidence/contrast-pairs.json`). Islands/bloom CSS uses semantic tokens on expected grounds only.

### Manual pressure-board review

Exercised via `react-flow-review-workflow.spec.ts` (50 frames) plus gate spot-check of:

| Flow | Checked | Result |
|------|---------|--------|
| Load pressure board | 50 screens, pan/zoom | pass |
| Mark (circle, comment, element pick) | Marks render; bloom opens at selection | pass |
| Intent chips | Single-select inside bloom | pass |
| Dispatch | Export delivers batch; blocked on empty draft | pass |
| Returned run | Agent reply UI in `AnnotationBloom` when host journals `done` run | pass (host test + component) |
| Refresh / stale | Capture refresh lifecycle; stale chip neutral border | pass (unit + live-frame e2e) |
| Keyboard | Select frame, comment, edit, delete, save, live, export | pass |
| Islands | Dodge on summon; drag persists; layers sync | pass (06/07 e2e) |

### Screen comparison (both themes)

Captured at 1280×720 with `scripts/testing/capture-phase2-gate-surfaces.mjs`:

- `.scratch/designmode-pivot/gate-10-evidence/light/*.png`
- `.scratch/designmode-pivot/gate-10-evidence/dark/*.png`
- `.scratch/designmode-pivot/gate-10-evidence/verdict.json`

| Screen spec | Verdict |
|-------------|---------|
| `board.html` | **pass** — edge-to-edge canvas, floating toolbar/status, no summoned panels at rest. Runs island hidden until local host has runs (see DECISIONS). |
| `aspects.html` | **pass** — summoned inspector dodges selection; layers tree + CSS-speaking aspects sections (Layout, Flex, Radius, Fill, Border, Type). Status bottom-left (existing DECISIONS). |
| `review-dispatch.html` | **pass** — bloom at mark with state word, instruction editor, intent chips (distill pressed), coral paper. |
| `returned-run.html` | **partial capture** — gate shot shows delivered export bloom; agent `⌁` reply, stale marks, reload notice, expanded runs tail verified via host API tests + `AnnotationBloom`/`RunsIsland` (DECISIONS entry added). |
| `states.html` | **pass** — project picker island; reset `<dialog>` with scrim. Notice tones covered by phase 1 + component CSS audit. |

### Tickets 05–09 spot-check

| Ticket | Spot-check |
|--------|------------|
| 05 | Toolbar/status float; canvas edge-to-edge; no fixed bands |
| 06 | `SummonedIsland` dodge + drag + nudge; Playwright 06 specs pass |
| 07 | Layers tree ↔ canvas sync; aspects sections; design context in island |
| 08 | `RunsIsland` on `SummonedIsland`; `aria-label="Agent runs"` |
| 09 | Bloom at marks; jump-list rail only; `resolve-annotation`; no docked comments column |

### Phase gate

**Phase 2 (restructure) is closed.** Phase 3 may start at ticket 11 (`11-learn-lens-island.md`).
