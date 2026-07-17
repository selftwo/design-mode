# 08: The runs island

Status: open
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

- [ ] Runs island appears when a run starts, lists rows per the catalog, and stays available as history.
- [ ] Output tail expands per run; run states read as dot plus word.
- [ ] The old activity rail is gone; its testids/ARIA names are preserved or deliberately migrated (record under Comments).
- [ ] Queued, running, done, failed all render; done triggers refresh and notice as before.

## Verify

`npm run verify`. With the manual test host, dispatch a batch and watch a full run lifecycle in the island.
