# 15: m-web approve flows and the phase 4 gate

Status: done
Type: task
Phase: 4 (m-web)
Blocked by: 14
Spec: specs/m-web-review-companion.md

Read first: design/screens/m-web/thread.html approve states; the phase 4 done-when in design/HANDOFF.md.

## What to build

The responding half of the companion, then run the phase gate.

- Approving: accept a returned change or a teach annotation from the thread view, without the full island layout. Approval state round-trips through the host and is visible on the desktop canvas (thread state word updates).
- Rejection/dismissal per the thread screen's states.
- Confirm the authoring lockdown holds end to end: no route, deep link, or API call reachable from m-web can author marks, trigger capture, or compose dispatch.

Phase gate:

- [x] `npm run verify` passes.
- [x] The m-web surfaces in design/screens/m-web/ all render correctly at mobile-web widths, both themes.
- [x] Thread reading, reply, and approve work end to end against the same host and review-batch contract as desktop (Playwright at m-web breakpoints).
- [x] Nothing from the authoring toolset is reachable from this surface (asserted, not assumed).
- [x] Bundle cap and `ready-ms` hold on the desktop route.
- [x] Evidence recorded under Comments; the pivot's four phases are done — update `.scratch/designmode-pivot/spec.md` acceptance and record any final deviations in DECISIONS.md.

## Verify

This ticket is the verification for phase 4 and the close of the pivot.

## Comments

### `npm run verify`

- **Pass** — 160 unit tests, 33 e2e (2026-07-17 gate run).

### Bundle and `ready-ms`

| Metric | Ticket 14 | Gate run | Cap / bound |
|--------|-----------|----------|-------------|
| React Flow route gzip | 166,436 B | **166,519 B** | 168,740 B |
| `ready-ms` | holds | **227 ms** | holds (`.canvas-results/reactflow-runtime.json`) |

+83 B gzip over ticket 14; **2,221 B headroom** under cap. Zero new runtime dependencies.

### Approve contract

- Optional `resolvedAt` on `ReviewAnnotation` and `TeachAnnotation`; `resolveBoardAnnotation()` + existing `PUT /api/projects/:id/board`.
- m-web: **Approve change** on capture thread sheet when a `done` run exists; **Approve** on teach cards in Activity.
- Desktop: bloom and teach-note resolve write the same field; session `resolvedAnnotationIds` kept for immediate UI.
- Dismissal: veil/handle/Esc close the thread sheet per `thread.html` (no reject button in the screen spec).

### Playwright m-web coverage (ticket 15)

| Spec | Result |
|------|--------|
| `m-web-approve.spec.ts` returned-change approve → desktop bloom `✓ resolved` | pass |
| `m-web-approve.spec.ts` teach approve → desktop teach note resolved | pass |
| `m-web-approve.spec.ts` dispatch/teach POST 404; no canvas tools on route | pass |
| `m-web-reply.spec.ts` (ticket 14) | pass |

### Authoring lockdown

m-web client unchanged: `listProjects`, `loadBoard`, `saveBoard`, `listRuns`, SSE only. E2e asserts `POST /dispatch` and `POST /teach` return 404 from the m-web surface; `tool-comment`, `tool-circle`, `tool-learn`, and `reactflow-canvas` absent.

### Gate evidence

Captured at 390×844 with `scripts/testing/capture-phase4-gate-surfaces.mjs`:

- `.scratch/designmode-pivot/gate-15-evidence/{light,dark}/` — boards, capture, thread-open, thread-approved, runs, notices, theme-toggle
- `.scratch/designmode-pivot/gate-15-evidence/verdict.json`

### Pivot close

All fifteen issues `Status: done`. Four phase gates (04, 10, 13, 15) passed `npm run verify`. `.scratch/designmode-pivot/spec.md` acceptance checked. Persisted `resolvedAt` recorded in `DECISIONS.md`.

**Next:** none — designmode pivot sequence complete.
