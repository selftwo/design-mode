# 14: m-web companion — boards, threads, reply

Status: done
Type: task
Phase: 4 (m-web)
Blocked by: 13
Spec: specs/m-web-review-companion.md

Read first: all of design/screens/m-web/ (boards.html, thread.html, capture.html, runs.html, notices.html, index.html); the m-web section of design/HANDOFF.md.

## What to build

The reading half of the mobile-web review companion, served by the existing host as a separate route from the desktop canvas.

- Boards list per boards.html: the reviewer's boards with review state at a glance.
- Thread view per thread.html: open a bloomed thread's history (human comments, intent chips, agent candidate replies with the `⌁` glyph, teach notes), read it, and add a reply that lands in the same thread the desktop sees.
- Capture and runs views per capture.html and runs.html: read-only visibility into captures and run history.
- Notices per notices.html.
- Same host API and review-batch contract as desktop — no forked m-web endpoints; replies go through the same validated boundary.
- The m-web route must not load the React Flow canvas engine; keep it out of the desktop bundle measurement and give it no canvas dependency.

No mark authoring, no capture triggering, no dispatch composition, no layers-and-aspects island on this surface.

## Done when

- [x] The four read surfaces render correctly at the viewport widths in design/screens/m-web/, both themes.
- [x] A reply added on m-web appears in the same thread on desktop.
- [x] The m-web route ships without the canvas engine; `npm run measure` is unaffected.
- [x] Nothing from the authoring toolset is reachable.

## Verify

`npm run verify` plus a Playwright pass at the m-web breakpoints for boards → thread → reply.

## Comments

### `npm run verify`

- **Pass** — 158 unit tests, 30 e2e (2026-07-17).

### Bundle and `ready-ms`

| Metric | Phase 3 gate | Ticket 14 | Cap / bound |
|--------|--------------|-----------|-------------|
| React Flow route gzip | 163,468 B | **166,436 B** | 168,740 B |
| `ready-ms` | 212 ms | holds | unchanged |

m-web ships as a separate Vite entry (`m-web.html`); desktop measure policy unchanged.

### Playwright m-web coverage

| Spec | Result |
|------|--------|
| `m-web-reply.spec.ts` boards → capture → reply → desktop bloom | pass |
| `m-web-reply.spec.ts` no canvas engine on m-web route | pass |
| `m-web-reply.spec.ts` runs + notices at 390×844 | pass |

### Authoring lockdown

m-web client exposes only `listProjects`, `loadBoard`, `saveBoard`, `listRuns`, and SSE subscribe. No dispatch, capture, live, or teach endpoints. E2e asserts `reactflow-canvas` and `tool-comment` are absent on `/m-web.html`.

### Reply contract

Human replies persist on `ReviewAnnotation.replies` (optional array) and round-trip through `PUT /api/projects/:id/board`. Desktop `AnnotationBloom` renders the same replies beside the instruction editor.

**Next:** ticket 15 (`15-m-web-approve-and-gate.md`).
