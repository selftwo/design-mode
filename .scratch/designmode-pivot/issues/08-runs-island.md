# 08: The runs island

Status: done
Type: task
Phase: 2 (restructure)
Blocked by: 06
Spec: specs/redesign-visual-system.md

Read first: design/screens/returned-run.html; the Runs island, Status dot, and Agent activity row rows of design/components/catalog.md.

## What to build

Replace the floating `AgentActivityRail` with the runs island: a floating list of active and recent agent runs, present only while runs exist (active or recent history), fed by the same host SSE events (`src/features/local-host/local-host-client.ts`).

- Each row: presence dot (`.dm-dot`, `data-state="running|done|failed|waiting"`), what the run is doing, run id in mono, expandable output tail.
- Green is the only hue here; running never loops its dot animation; violet never marks a run.
- Runs remain visible as history when idle; the island participates in 06 placement (dodge, drag wins).
- A finished run still triggers the capture refresh and "reload board" notice through the existing lifecycle.

## Done when

- [x] Runs island appears when a run starts, lists rows per the catalog, and stays available as history.
- [x] Output tail expands per run; run states read as dot plus word.
- [x] The old activity rail is gone; its testids/ARIA names are preserved or deliberately migrated (record under Comments).
- [x] Queued, running, done, failed all render; done triggers refresh and notice as before.

## Comments

### Verify — 2026-07-17 (parent intervention)

`npm run verify` **pass** (138 unit, 23 e2e).

| Check | Result |
|-------|--------|
| gzip (reactflow route) | 156,822 B (cap 168,740 B) |
| testids | `agent-activity`, `capture-activity`, `agent-run-*`, `agent-run-status-*` preserved |
| ARIA | `aria-label` migrated `Agent activity` → `Agent runs` (screen file `returned-run.html` wins) |

### Changes

- **`RunsIsland.tsx` / `.css`:** Replaces `AgentActivityRail`. Summoned island with dodge/drag; `.dm-run-row` + `.dm-dot` rows; expandable output tail; open while runs exist or capture is active.
- **`App.tsx`:** Mounts `RunsIsland` from the same SSE `agentRuns` / `captureActive` state; refresh + reload-board lifecycle unchanged.
- **Deleted:** `AgentActivityRail.tsx` / `.css`.
- **Recovery (blocking e2e):** Re-applied ticket 05 floating shell CSS (edge-to-edge canvas, `.toolbar-island`, status island, notice `top: 4.5rem`) and restored DLS tokens via `@import` of `design/tokens/tokens.css` after those edits had been lost from `app.css` while `App.tsx` kept the floating structure.

### Leftover for ticket 09

Untracked `AnnotationBloom.tsx` / `.css` remain from an early bloom attempt; not wired. Ticket 09 is next.

## Verify

`npm run verify`. With the manual test host, dispatch a batch and watch a full run lifecycle in the island.
