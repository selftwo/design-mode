# 11: The learn lens island

Status: done
Type: task
Phase: 3 (differentiators)
Blocked by: 10
Spec: specs/learn-lens-teach-annotations.md

Read first: design/screens/learn-lens.html; the Learn lens row of design/components/catalog.md; design/_wayfinder/notes/04-paper-pencil.md for why this exists.

## What to build

A hidden, invoked-on-demand floating island (`.dm-island` + `.dm-learn`), summoned from the toolbar's Learn tool. Teal is its only hue.

- While open, clicking an element on a frame (the host-extracted element bounds already power select-mode picking) shows that element's anatomy: what it is, how it is structured, and the vocabulary term for it (`.dm-learn-anatomy`, `.dm-learn-term`, `.dm-learn-why`). Empty state per `.dm-learn-empty`.
- Clicking a different element updates the content in place; the lens never moves or snaps back.
- Draggable by its header, closable, keyboard-nudgeable when focused (the 06 mechanism).
- The reviewer can ask one question about the current element. The question goes to the host, which routes it to the configured agent adapter (reuse the dispatch plumbing in `host/`; the browser contract stays agent-neutral and Zod-validated, no agent/model/command/vendor fields). The answer renders inside the lens, non-actionable: it explains, it never generates or dispatches a change.
- Anatomy/vocabulary content derives from the extracted element data plus the shared vocabulary already encoded for intents; extend `host/build-agent-prompt.ts` sideways with a teach prompt builder rather than forking it.

## Done when

- [x] Learn tool summons the lens; clicking elements populates anatomy and vocabulary; content updates in place on each new click.
- [x] Lens drags, closes, and arrow-key nudges; position never resets while open.
- [x] A question round-trips through the host to an agent and renders inline; nothing in the answer is actionable.
- [x] The lens is teal throughout; no violet, coral, or green inside it.
- [x] Playwright: open the lens, drag it, click a second element, assert content updated and position held.

## Comments

**Verify (2026-07-17):** `npm run verify` passed — 146 unit tests, 26 e2e tests, build clean.

**Gzip:** React Flow route `161,564` B (cap `168,740` B; reference ×1.2).

**Playwright:** `e2e/review-board/react-flow-learn-lens.spec.ts` — open lens, drag, pick second element, assert `learn-lens-sub` / `learn-lens-term` update and island position holds.

**Host:** `POST /api/projects/:id/teach` with `TeachQuestionSchema`; `buildTeachPrompt` + synchronous agent stdout; host test `answers a teach question through the configured agent`.

**Manual:** Compare against `design/screens/learn-lens.html` in light and dark (teal `.dm-learn*` only; ask form + inline answer non-actionable).

## Verify

`npm run verify`. Manual pass against design/screens/learn-lens.html, both themes.
