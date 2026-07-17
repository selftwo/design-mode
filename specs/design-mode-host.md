---
title: Local host app with project capture and agent dispatch
status: shipped
---

## Problem Statement

The review canvas required a coding agent session to produce boards, a hand-run capture script per project, and a window message host that only test fixtures implemented. There was no way to pick a project, pull fresh screens, read the project's design context, or send a validated review batch to a real coding agent without leaving the canvas.

## Solution

One local host process (`npm run app`) serves the built canvas and an HTTP API that owns everything outside the review contract: a project registry, screen capture with element extraction, board persistence, project design context files, live page proxying, and agent dispatch behind adapters. The canvas detects the host through an injected marker and speaks the same `BoardHost` contract over HTTP that the window message host speaks over `postMessage`.

Agent runs are first-class collaborators: the host journals every run, streams run and capture events over server-sent events, and re-captures the project's screens when a run finishes, so stale marks show what the agent changed.

## User Stories

1. As a reviewer, I want to start one command and get the whole app, so that reviewing does not require a coding agent session.
2. As a reviewer, I want to register a project by path, dev command, port, and routes, so that the host can produce boards for it.
3. As a reviewer, I want the host to boot the project's dev server and capture its routes with element bounds, so that boards reflect the real product.
4. As a reviewer, I want boards persisted by the host, so that autosave works across sessions and browsers.
5. As a reviewer, I want to read DESIGN.md, PRODUCT.md, AGENTS.md, and README.md beside the board, so that feedback follows the project's own design language.
6. As a reviewer, I want to import images by drag and drop or a file picker, so that mocks and references join the board as annotatable frames.
7. As a reviewer, I want to tag a comment with a design intent (bolder, quieter, typeset, layout, and the rest), so that agents receive direction, not only prose.
8. As a reviewer, I want to send the validated batch to Claude Code, Codex, or Cursor, so that feedback becomes source changes without leaving the canvas.
9. As a reviewer, I want to see agent runs as live presence with status and output, so that agent collaboration feels like a multiplayer board.
10. As a reviewer, I want a finished run to refresh captures and mark stale feedback, so that I can verify what changed.
11. As a reviewer, I want live view to work on any registered project page, so that behavior can be inspected without the project implementing our protocol.

## Implementation Decisions

- The host is TypeScript under `host/`, executed by Node's native type stripping. It shares the boundary schemas in `src` directly; shared value-import chains use explicit `.ts` extensions.
- The HTTP API is validated with Zod on both sides: the host parses requests and stored files, the canvas parses responses and events.
- The canvas keeps one `BoardHost` contract. `createLocalHostClient` implements it over HTTP plus the host-only operations (projects, capture, context, agents, runs, events).
- The review batch stays agent neutral. Vendor commands live only in `host/agent-adapters.ts`; the dispatch request names an adapter id, and the prompt is built once for all agents from the batch, the project context files, and the shared intent guidance.
- Every run is journaled under the data directory (`run.json`, `prompt.md`, `batch.json`, screenshots) for inspection and replay.
- Live view proxies the project dev server on a dedicated port and injects a handshake script that answers `design-review/live-hello`, instead of requiring projects to implement the live protocol.
- A re-capture merges into the existing board: frame layout, labels, camera, and annotations are preserved; capture identity advances only when the screenshot hash changes.
- Host state lives in `~/.design-mode` (override with `DESIGN_MODE_HOME`).

## Out of Scope

- Multi-reviewer boards and remote access; the host binds 127.0.0.1.
- Queueing or cancelling agent runs.
- Impeccable-style in-page variant cycling; dispatched agents may use Impeccable in the target repo instead.
- Packaging as a desktop shell; the host is the foundation a shell would wrap.
