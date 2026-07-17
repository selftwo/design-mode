# 04: Phase 1 gate — verify the re-skin

Status: open
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

- [ ] `npm run verify` passes with no test edits beyond additions.
- [ ] `npm run measure` holds the gzip cap; the `ready-ms` bound holds.
- [ ] AA check recorded under Comments: pairs checked, ratios, both themes.
- [ ] Before/after captures of the five surfaces reviewed on the canvas; verdict recorded under Comments.
- [ ] Grep confirms no literal color/font-size/spacing outside the token block.

## Verify

This ticket is the verification. Do not close it with any box unchecked; fix regressions in place or reopen 01–03.
