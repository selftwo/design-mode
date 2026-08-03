# 02: m-web reply/approve is last-writer-wins and never notifies the desktop

Status: done
Type: task
Severity: high (data loss)

## Defect

Two halves, both needed:

1. `src/features/m-web/MWebCapturePage.tsx:110-139` loads the board once on mount (no `board-updated` SSE subscription) and `submitReply`/`submitApprove` PUT the entire stale board document. If the desktop reviewer added annotations after the phone loaded, the phone's PUT silently deletes them.
2. `host/design-mode-host.ts:381-383`: the `PUT /board` handler does not publish `board-updated` (the capture path at ~398-399 does). The desktop never learns about the phone's reply; the desktop's next autosave (600ms debounce, `App.tsx:165-170`) PUTs its own in-memory board and permanently erases the reply/approval.

## Fix

Preferred shape: stop PUTting whole boards from m-web for these two verbs. Add narrow host mutations that read-modify-write server-side on the current stored board — reply append and `resolvedAt` set are both single-annotation field merges (`resolveBoardAnnotation()` already exists as the shared merge helper). Either dedicated routes or a PUT variant carrying only the annotation delta; Zod-validate both sides per AGENTS.md rule 4. Then publish `board-updated` from every board write path, and have both m-web pages and the desktop subscribe (desktop already handles `board-updated` with the dirty-guard reload notice; confirm the reply merge does not mark the desktop board dirty-conflicted).

## Done when

- [x] Phone reply/approve cannot delete desktop annotations created after the phone loaded (host test: register project, PUT board with 2 annotations, m-web-style reply against a stale copy, assert both annotations survive plus the reply).
- [x] A reply or approval from m-web appears on the open desktop board without a manual reload (SSE `board-updated` observed; e2e or host integration test).
- [x] Desktop autosave after a phone reply does not erase the reply.
- [x] All board write paths publish `board-updated`.

## Verify

`npm run verify`.

## Comments

- Added `POST /api/projects/:id/board/reply` and `/board/resolve` with Zod schemas; `writeBoardAndPublish` on PUT, capture, refresh, and mutations.
- m-web client uses `replyToThread` / `resolveAnnotation`; capture and runs pages subscribe to `board-updated`.
- Host tests: stale-reply survival + `board-updated` SSE on PUT and resolve.
- E2e: `m-web-reply.spec.ts` and `m-web-approve.spec.ts` pass.
