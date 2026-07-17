---
title: Learn lens and teach annotations
status: approved
---

## Problem Statement

The canvas dispatches work but teaches nothing. A reviewer who does not know what an element is called, how it is structured, or why it works has no way to ask without leaving the tool. Neither Paper.design nor Pencil.dev has an equivalent affordance; this is designmode's own move (`design/_wayfinder/notes/04-paper-pencil.md`).

## Solution

Two connected capabilities, in the teal teach hue, per `design/screens/learn-lens.html` and the `Learn lens` and `Teach note` rows of `design/components/catalog.md`.

### The learn/ask lens

A hidden, invoked-on-demand floating island (`.dm-island` + `.dm-learn`). Clicking an element while it is open shows that element's anatomy: what it is, how it is structured, and the vocabulary term for it, drawn from the host-extracted element data. The reviewer can ask one question; the agent's answer renders inside the lens, non-actionable — it explains, it never generates or dispatches a change. The lens is draggable by its header, closable, keyboard-nudgeable when focused, updates content in place on each new element click, and never snaps back to a default position.

### Teach annotations

An agent answer from the lens can also be pinned to the canvas as an anchored comment at the clicked element (`.dm-teach-note`), in teal, carrying the `⌁` provenance glyph that marks anything machine-authored. This uses the same review-batch contract as a dispatched fix, reversed in direction: the agent annotates for the human. Teach notes have no routing and no dispatch.

### Theme toggle

If the dark theme was only scaffolded in phase 1, it ships here as a first-class, user-facing toggle.

## Constraints

- Every hard constraint in `design/HANDOFF.md`: zero new runtime dependencies, bundle cap, `ready-ms`, testid/ARIA preservation, React Flow styled via variables only, AA in both themes.
- Teal is reserved for teach material; the lens and teach notes never use violet, coral, or green.
- No generation chat: one question, one answer, inside the lens. The answer is never actionable from the lens.
- The question round trip goes through the host boundary with the same agent-neutral, schema-validated contract discipline as dispatch (Zod schema, no agent, model, command, or vendor field in the browser-side contract).

## Acceptance

- [ ] The lens opens on demand, is draggable and closable, and is keyboard-nudgeable when focused.
- [ ] Clicking a second element while the lens is open updates its content in place; the lens position does not move.
- [ ] A question asked in the lens produces an inline answer; the answer is non-actionable.
- [ ] The reviewer can pin an answer; a teach annotation appears anchored at the element in teal with the `⌁` glyph.
- [ ] Playwright covers: open the lens, drag it, click a second element, assert content updates and position holds; assert a pinned answer appears on the canvas with the `⌁` glyph and the teal hue.
- [ ] `npm run verify` passes.
