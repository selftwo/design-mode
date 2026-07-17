# 09: Bloom threads at their marks

Status: open
Type: task
Phase: 2 (restructure)
Blocked by: 06
Spec: specs/redesign-visual-system.md

Read first: design/screens/review-dispatch.html and design/screens/returned-run.html; the Bloom, Comment, Mark reference, Scope chip, and Intent chip rows of design/components/catalog.md; the annotation vocabulary note at design/_wayfinder/notes/02-annotation-patterns.md.

## What to build

Move comment threads out of the docked comments panel onto the canvas. Selecting a mark opens its thread in place at the mark (`.dm-bloom[data-open]`), scaling from its mark with the one settle.

- Thread anatomy per the catalog: head with a state word (open in coral, draft, ✓ resolved), human comment with intent chips (`.dm-chip`, pressed chips turn coral inside a bloom), agent candidate reply with the accent-filled avatar and the `⌁` provenance line, routing foot (`--returned`, `.dm-rdot`).
- Stale threads note "anchor is approximate"; the mark and its scope chip flip to the neutral stale state, never alarmist red.
- The instruction editor (`AnnotationInstructionEditor`) renders inside the bloom instead of a panel.
- `ReviewCommentsPanel` becomes a jump-list rail only: a secondary way to reach a thread (click scrolls/opens the bloom), plus the pooled copy/send actions. It is summoned, not docked.
- Blooms participate in 06 placement so an open thread does not cover its own mark.
- Dispatch, export, and the review-batch contract are unchanged.

## Done when

- [ ] Selecting a mark opens its thread at the mark; editing, intent chips, delete, and reply all work inside the bloom.
- [ ] Machine-authored entries show the agent avatar and `⌁` glyph; thread states render as words.
- [ ] Stale marks and threads show the neutral stale treatment.
- [ ] No docked comments panel remains; the rail is a jump list that opens blooms.
- [ ] Existing annotation and export e2e flows pass with edits only where the panel-bound interaction moved (record every migrated testid under Comments).
- [ ] New Playwright coverage: open a bloom, edit an instruction, pick an intent, resolve; jump-list click opens the right bloom.

## Verify

`npm run verify`. Manual pass against the two screen specs, both themes.
