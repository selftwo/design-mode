# 06: m-web boards list refetches every board on every run-updated chunk

Status: done
Type: task
Severity: medium (mobile bandwidth)

## Defect

`src/features/m-web/MWebBoardsPage.tsx:27-49`: `runs` is in the effect deps and the host publishes `run-updated` on every stdout chunk of a running agent. While an agent streams, the phone re-downloads every project and every full board document (base64 screenshots included) dozens of times.

## Fix

`buildBoardListEntry(…, runs)` only needs the runs it already has: split the effect so boards/projects fetch once (and on `board-updated` / `capture-*` events only), while run rows recompute from the SSE payload in memory.

## Done when

- [x] A streaming run causes zero additional `GET /board` requests from the boards page (host test counting requests, or unit test on the effect split).
- [x] Run status rows still update live.

## Verify

`npm run verify`.

## Comments

Split project/board loading from in-memory run-row derivation. Board refreshes now happen only for board and capture host events.
