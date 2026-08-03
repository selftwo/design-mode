---
title: Hybrid tooling — Agentation for pointed feedback, design-mode for canvas review
status: approved
date: 2026-08-03
---

## Goal

Split the jobs cleanly:

1. **Agentation** owns Cursor-style pointed feedback on a live webapp (annotate element → agent fix).
2. **design-mode** owns the Figma-like review canvas (multi-screen compare, history, collaboration, verdicts, teach/learn).

Do not rebuild Agentation’s in-page toolbar inside design-mode. Do not demote design-mode into a thin overlay.

## Job boundary

| Job | Tool | Why |
| --- | --- | --- |
| Point at one control, leave a note, get a code fix | Agentation | Fastest install; MCP/AFS; text/element/area modes |
| Freeze animation / layout sketch on the live page | Agentation | Built-in pause + layout mode |
| Review many captures / options side by side | design-mode | Infinite canvas + units/zones |
| Stamp / kill options into a decision ledger | design-mode | Verdict loop already on `main` |
| Threaded review history on marks | design-mode | Bloom threads + m-web approve (pivot branch) |
| Learn element anatomy / pin teach notes | design-mode | Learn lens + `⌁` teach annotations (pivot) |
| Mobile read/reply/approve of a board | design-mode m-web | Companion entry on pivot branch |

## Current git state (resolved containment)

As of 2026-08-03, local repo `/Users/corphr.software/Documents/design-mode`:

| Ref | Tip | Meaning |
| --- | --- | --- |
| `main` / `origin/main` | `79fc803` | Collaboration surface shipped (playable options, units, zones, verdicts, agent blooms) |
| `pivot/designmode-islands-wip` | `e429968` | Full DLS pivot: islands, bloom threads, learn/teach, m-web, gate evidence |
| Merge-base | `8fe4635` | Pivot docs landed; both lines diverge after this |

Uncommitted pivot WIP is no longer loose on disk — it is committed on `pivot/designmode-islands-wip`. Local `main` matches `origin/main`.

A first rebase attempt of the pivot onto `main` found **20 conflict files** (~55 hunks). Rebase was aborted on purpose; merge is the next engineering task, not a blocker for using Agentation.

## Merge plan (pivot → main)

Work on a throwaway branch from `main`:

```sh
git checkout -b integrate/pivot-onto-collaboration main
git merge pivot/designmode-islands-wip
# or: git checkout pivot/designmode-islands-wip && git rebase main
```

### Conflict hotspots (from the aborted rebase)

Resolve in this order — schema and host contracts before UI:

1. **Board contract** — `src/features/review-board/model/board-document.schema.ts`, `review-batch.ts` (+ tests)
   - Keep collaboration `schemaVersion: 2` (units, zones, verdicts, liveSource, kit).
   - Re-apply pivot fields the UI needs (thread replies, teach notes, `resolvedAt`, element aspects) without collapsing v2.
2. **Host** — `host/design-mode-host.ts` (+ tests), `host/build-teach-prompt.ts` (+ tests)
   - Keep playable-option / unit generation / canvas-event ingest from `main`.
   - Keep pivot teach-run + m-web board routes; union add/add teach prompts carefully.
3. **Host client / API schema** — `local-host-client.ts`, `host-api.schema.ts`
4. **Canvas engines** — `ReactFlowReviewBoard.tsx`, `ScreenFrameNode.tsx`, `ScreenFrameSurface.css`, `canvas-engine.ts`, Excalidraw adapter
   - Preserve playable iframe + play/review pointer contract from `main`.
   - Layer pivot island chrome and bloom marks on top.
5. **App shell** — `src/app/App.tsx` (largest UX merge)
   - Collaboration islands already on `main` (UnitQueue, DecisionLedger, LearnAsk, Runs).
   - Pivot adds SummonedIsland placement, LayersAndAspects, bloom threads, theme toggle, m-web entry.
   - Prefer one island system; delete duplicated rails/panes.
6. **Comments / instruction UI** — `ReviewCommentsPanel.tsx`, `AnnotationInstructionEditor.tsx`
7. **RunsIsland add/add** — `RunsIsland.tsx` / `.css` (both lines added a runs island; keep one API).
8. **DECISIONS.md** — concatenate both decision streams chronologically.

### Merge acceptance

- `npm run verify` green on the integrate branch.
- Collaboration e2e still pass: playable options, verdicts, zones, teach-note (main).
- Pivot e2e still pass: island dodge/drag, bloom, learn lens, teach annotation, m-web, stale recovery.
- No second in-page Agentation clone appears in this repo.

### After merge

1. Push `pivot/designmode-islands-wip` (backup) if not yet on origin.
2. Open PR: integrate branch → `main`.
3. Close or supersede conductor worktree `design-canvas-status-prfaq` once `main` is the single tip.
4. Work remaining polish from `.scratch/designmode-pivot-qa/` against the merged tree.

## Agentation adoption plan

Target: any React 18+ webapp under active design review (dev-only).

1. `npm install agentation agentation-mcp -D` (or package manager equivalent).
2. Mount `<Agentation />` behind `NODE_ENV === "development"`.
3. Wire MCP: `npx add-mcp "npx -y agentation-mcp server"` for Cursor / Claude Code.
4. Smoke: annotate one element, copy Standard output, confirm agent can `grep` the selector; optionally enable watch mode.
5. Document in the target app’s AGENTS/README: “pointed UI feedback → Agentation; multi-screen review → design-mode.”

License note: Agentation is PolyForm Shield — fine for internal/dev use; confirm before redistributing a product that embeds it.

## design-mode product focus (post-merge)

Prioritize canvas jobs Agentation will never own:

1. **Option studio** — playable lo-fi options, kit dials, stamp/kill verdicts, decision ledger (already on `main`).
2. **Review history** — bloom threads at marks, resolve/approve, m-web companion for read/reply/approve (pivot).
3. **Spatial judgment** — multi-frame board, zones, references, stale-after-agent-recapture.
4. **Teach channel** — learn lens + pinned `⌁` notes (pivot), unified with main’s LearnAsk island.
5. Later (ROADMAP): per-project vocabulary, blind compare, image probes, more agent adapters.

Explicit non-goals for design-mode:

- Shipping a general-purpose in-page annotation toolbar.
- Competing with Agentation on copy-markdown / MCP watch loops for single-page fixes.

## Suggested sequence

| Step | Action | Done when |
| --- | --- | --- |
| A | Use Agentation in the active webapp | Dev toolbar + MCP doctor ok |
| B | Push `pivot/designmode-islands-wip` for backup | Branch on origin |
| C | Merge pivot onto collaboration (`integrate/…`) | `npm run verify` |
| D | PR into `main` | Merged |
| E | Pivot-QA polish (`.scratch/designmode-pivot-qa`) | QA issues closed or re-ticketed |
| F | Daily split: Agentation for pointed; design-mode for canvas sessions | Habit + short docs |

## Open choices (do not block A–C)

- Which webapp gets Agentation first (path/repo).
- Whether learn UX keeps pivot’s floating LearnLens or main’s LearnAskIsland (merge should pick one surface, teal hue job unchanged).
- Whether m-web ships in the same PR as the island merge or a fast follow.
