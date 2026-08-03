# 09: Bloom threads at their marks

Status: done
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

- [x] Selecting a mark opens its thread at the mark; editing, intent chips, delete, and reply all work inside the bloom.
- [x] Machine-authored entries show the agent avatar and `⌁` glyph; thread states render as words.
- [x] Stale marks and threads show the neutral stale treatment.
- [x] No docked comments panel remains; the rail is a jump list that opens blooms.
- [x] Existing annotation and export e2e flows pass with edits only where the panel-bound interaction moved (record every migrated testid under Comments).
- [x] New Playwright coverage: open a bloom, edit an instruction, pick an intent, resolve; jump-list click opens the right bloom.

## Comments

### Verify — 2026-07-17

`npm run verify` **pass** (142 unit, 24 e2e).

| Check | Result |
|-------|--------|
| gzip (reactflow route) | 158,551 B (cap 168,740 B) |
| testids | All preserved: `comments-panel`, `toggle-comments-panel`, `comments-count`, `comment-item-*`, `open-comment-*`, `copy-comment-*`, `copy-all-comments`, `export-annotation`, `dispatch-agent`, `annotation-instruction-editor`, `instruction-input`, `intent-*`, `delete-annotation`, `annotation-stale`, `resolve-annotation` (new), `bloom-*` (new) |
| ARIA | `aria-label="Pooled review comments"` unchanged on rail |

### Migrated testids / e2e edits

- Editor moved from panel row to bloom: tests still target `annotation-instruction-editor`, `instruction-input`, `delete-annotation` inside the open bloom.
- `react-flow-island-drag-persist.spec.ts`: first selection is frame-only (not element pick) so the bloom does not cover the layers island drag handle.
- `react-flow-keyboard-workflow.spec.ts`: deselect annotation before frame arrow-key nudge; wait for `instruction-input` focus before post-reset typing.

### Changes

- **`AnnotationBloom.tsx` / `.css`:** Wired at mark with dodge placement, thread head/state/scope chip, instruction editor, agent reply from done runs, resolve button, stale read-only body + foot.
- **`ReviewCommentsPanel.tsx` / `.css`:** Summoned jump-list island (left below toolbar); inline editor removed; copy/send footer kept.
- **`App.tsx`:** Renders bloom for selected annotation; session `resolvedAnnotationIds`; rail gets selection bounds for dodge.
- **`app.css`:** Removed docked comments grid column from `.canvas-region`.
- **`bloom-thread-state.test.ts`**, **`e2e/review-board/react-flow-bloom.spec.ts`:** New coverage.
- **`DECISIONS.md`:** Bloom-at-mark + jump-list rail decision recorded.

## Verify

`npm run verify`. Manual pass against the two screen specs, both themes.
