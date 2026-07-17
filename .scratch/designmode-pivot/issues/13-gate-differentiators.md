# 13: Phase 3 gate — verify the differentiators

Status: open
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

- [ ] `npm run verify` passes, including the 11 and 12 Playwright additions.
- [ ] Bundle cap and `ready-ms` hold (the lens and teach plumbing added no runtime dependency and no bundle regression).
- [ ] Theme toggle reviewed as a user-facing control in both themes.
- [ ] Evidence recorded under Comments; deviations from the screens recorded in DECISIONS.md.

## Verify

This ticket is the verification. Fix regressions in place or reopen 11–12.
