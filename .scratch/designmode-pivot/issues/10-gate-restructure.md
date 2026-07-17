# 10: Phase 2 gate — verify the restructure

Status: open
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

- [ ] `npm run verify` passes, including the 06 and 09 Playwright additions.
- [ ] `npm run measure` holds the gzip cap; `ready-ms` holds.
- [ ] The keyboard workflow e2e passes on the new layout.
- [ ] A full manual review pass on the pressure board is recorded under Comments (what was checked, what broke, what was fixed).
- [ ] Screens match design/screens/board.html, aspects.html, review-dispatch.html, returned-run.html, states.html in both themes; deviations recorded in DECISIONS.md.

## Verify

This ticket is the verification. Fix regressions in place or reopen 05–09.
