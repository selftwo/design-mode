# 12: Teach annotations pinned to the canvas

Status: open
Type: task
Phase: 3 (differentiators)
Blocked by: 11
Spec: specs/learn-lens-teach-annotations.md

Read first: the Teach note row of design/components/catalog.md; the teach-annotation paragraphs in design/HANDOFF.md.

## What to build

Let the reviewer pin an agent answer from the learn lens onto the canvas as an anchored teach annotation at the clicked element.

- Rendering: `.dm-teach-note` — teal paper, agent voice, `⌁` provenance glyph, `.dm-teach-chip`, stem fading in at 0.6, scaling from its anchor. No routing, no dispatch, no intent chips.
- Contract: the same review-batch shape as a dispatched fix, reversed in direction — the agent annotates for the human. Model it in the board document schema (`src/features/review-board/model/board-document.schema.ts`) as an annotation variant with machine provenance and the element anchor; it persists, reloads, and goes stale by capture hash and revision exactly like review annotations.
- Teach annotations appear in the layers tree and the jump-list rail, and are approvable/deletable like other annotations, but never export into a dispatch batch.
- Stale behavior: neutral stale treatment when the frame revision advances, same as review marks.

## Done when

- [ ] Pinning an answer creates an anchored teal note with the `⌁` glyph at the element; it survives reload.
- [ ] Teach annotations never appear in an exported review batch (schema test proves it).
- [ ] Staleness flips on capture refresh like review annotations.
- [ ] Playwright: ask in the lens, pin, assert the note on the canvas with the `⌁` glyph and teal hue.
- [ ] Zod schema changes are versioned and validated at the host boundary like every other message.

## Verify

`npm run verify`. Manual: pin, reload, refresh capture, watch it go stale.
