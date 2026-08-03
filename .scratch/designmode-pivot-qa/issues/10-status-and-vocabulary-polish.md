# 10: Status island hygiene and thread vocabulary polish

Status: done
Type: task
Severity: P2 (bundle of small fidelity and copy fixes)
Blocked by: 08

## Defects

Status island (`App.tsx:867-899`) vs `board.html:244` (`3 screens · 3 annotations · saved · live off`):

1. Two adjacent slots both print `none selected` at rest (`App.tsx:874,876`) — reads as a stutter and announces twice via `aria-live`.
2. `selected-annotation` prints a full UUID; the aspects island and thread header do the same (`selected-annotation-id`). Machine talk in a human surface — show the mark ordinal (`#1`) and keep the UUID in a `title`/data attribute.
3. `screenshot mode` and the `ready-ms` readout (`106 ms`) are harness readouts in product chrome. Keep the testids and the values in the DOM if e2e needs them, but visually de-emphasize or hide behind a dev flag; `focus-state` idle word is already recorded as an e2e-contract deviation in DECISIONS.md — extend that entry with whatever this ticket changes.

Thread vocabulary vs the catalog and `review-dispatch.html`:

4. State words render uppercase mono `OPEN`; binding is lowercase `open`.
5. Scope chip reads `path · #1` without the anchor glyph; binding vocabulary is `○ circle · #1` (glyph per mark kind).
6. Bloom width 288px (`AnnotationBloom.css:5`) vs 304px (`review-dispatch.html:89`).
7. `.comment-chip.intent` (`ReviewCommentsPanel.css:173-177`) uses the info family for intent chips in the jump list — a fifth hue doing intent duty. Catalog: neutral at rest, violet pressed, coral only inside a bloom.
8. Theme toggle: quiet word in light mode, solid violet fill in dark (visual-proof/after/02) — violet means active tool. Make both themes the quiet treatment, and make the accessible name state-honest ("Switch to dark theme" or `aria-pressed` semantics on a stable "Dark theme" label) rather than the bare target word.
9. Board-name panel pill (`▦ <board name>`, `board.html` top right) is absent at rest; restore it.
10. The third zoom control clips at the bottom-left canvas edge (visual-proof/after/01); unclip.

Any e2e string these change (`none selected`, focus-state words, state-word case) is a listed contract migration: update the assertions in the same commit and record the migration under this ticket's Comments and in `DECISIONS.md`.

## Done when

- [x] Status island reads as plain words with no duplicate segment and no raw UUID; screen-reader announcement checked.
- [x] Thread state words lowercase; scope chips carry the mark-kind glyph; bloom at 304px.
- [x] Intent chips in the jump list use the catalog treatment (no info family).
- [x] Theme toggle consistent across themes and state-honest for screen readers.
- [x] Board pill restored; zoom controls fully visible.
- [x] Every migrated testid/string listed under Comments.

## Verify

`npm run verify`. Side-by-side with `board.html` and `review-dispatch.html`, both themes.

## Comments

Status now uses annotation ordinals, thread chips use glyph vocabulary and neutral intent styling, bloom width matches the screen, and the board pill is restored. The selected annotation UUID remains in `title` for diagnostics.
