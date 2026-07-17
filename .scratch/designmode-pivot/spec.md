---
title: Designmode pivot — rebuild the canvas on the handed-off design language system
status: approved
---

# PRD: the designmode pivot

Everything built so far was prototyping: proving that a React Flow review canvas, a local host, capture, live view, and agent dispatch are possible. They are. This effort rebuilds the product on the completed design direction handed off in `design/` (copied from `claude-design/dls/designmode`). It is not a reskin alone: layout, interaction model, and two new capabilities change.

## Binding sources, in reading order

1. `design/HANDOFF.md` — what the product is, the design direction, the feature list, the phased roadmap, the hard constraints. If it conflicts with a screen file, the screen file wins.
2. `design/tokens/tokens.css` — the "Violet ink" token set: light default plus `[data-theme="dark"]`, AA ratios annotated per pair.
3. `design/components/catalog.md` and `design/components/components.css` — the component inventory, anatomy, states, and hue jobs.
4. `design/showcase.html` — every component, both themes, realistic content.
5. `design/screens/*.html` — the 8 binding desktop screens: board, review-dispatch, returned-run, aspects, learn-lens, live-view, compare, states.
6. `design/screens/m-web/*.html` — the 5 mobile-web review-companion screens.
7. `ROADMAP.md` and `specs/` — this repo's ambition ledger and spec format.

## What the product is

A personal design review canvas. Captured screens from other products sit on a spacious canvas; the reviewer marks a screen, attaches an intent, and dispatches the mark to a coding agent in a CLI. The agent works on the real codebase and replies; the reply lands back as an anchored comment. No generation chat on the canvas: the canvas is for spatial judgment and marking. A second lens teaches: click an element, see its anatomy and vocabulary, ask one question, and the answer lands as an anchored teach annotation carrying the `⌁` provenance glyph.

## The design direction (binding rules)

- Edge-to-edge canvas with a dot grid. All chrome floats as islands; no panel is docked or permanent. A panel appears only when summoned by a selection or an invoked tool.
- **Dodge by default, drag wins.** A summoned island never covers the current selection. If the reviewer drags it, that placement holds for the session and dodging stops until deselect and reselect.
- **Threads bloom in place.** A comment thread opens at its mark on the canvas. Any rail is a jump list only.
- **The learn lens floats free.** Draggable, closable; clicking a different element updates its content in place; it never snaps back.
- **One hue, one job.** Violet is the tool signal (selection, pressed, focus, active tool). Coral is review annotations. Teal is the teach lens. Green is run states. No hue does double duty.
- **The aspects panel speaks CSS.** Layout, Flex, Radius, Fill (swatch plus named token), Border, Type — the reviewed product's own terms.
- Both themes ship. Light is default; dark exists so light-colored captured screens pop against the chrome.

## Phases

Each phase is scoped, sequenced, and ticketed in `.scratch/designmode-pivot/issues/`. Work tickets in number order; a ticket is done only when its acceptance list is checked and its verify steps pass.

1. **Re-skin** (issues 01–04). DLS tokens replace the `:root` seam in `src/app/app.css`; every component CSS file moves onto the spacing and type tokens; components restyle against the DLS classes; inline SVG icons redraw to the DLS stroke style; `[data-theme="dark"]` toggle ships. Spec: `specs/redesign-visual-system.md`.
2. **Restructure** (issues 05–10). Islands over an edge-to-edge canvas replace the docked panels; dodge-by-default placement with drag-to-place wins; comment threads bloom in place at their marks. Spec: `specs/redesign-visual-system.md`.
3. **Differentiators** (issues 11–13). The floating learn/ask lens and teach annotations (agent answers pinned to the canvas in teal with the `⌁` glyph). Spec: `specs/learn-lens-teach-annotations.md`.
4. **m-web** (issues 14–15). The simplified mobile-web review companion: read, reply, approve only. Spec: `specs/m-web-review-companion.md`.

Later phases (per-project vocabulary, blind compare, verdict staleness, image-probe lanes, more adapters plus a `design-mode` CLI, desktop shell, motion and sound) are not scoped here. Each graduates into its own spec in `specs/` when its trigger in `design/HANDOFF.md` is met.

## Hard constraints, every phase, no exceptions

- Gzip bundle cap on the React Flow route: reference size × 1.2, enforced by `npm run measure` (`scripts/testing/canvas-bundle-policy.mjs`). Excalidraw stays lazy-loaded and out of the default bundle.
- Zero new runtime dependencies. The set stays `@xyflow/react`, `@excalidraw/excalidraw`, `react`, `react-dom`, `zod`. Islands, dodge, drag, and bloom threads are buildable with this stack.
- Every `data-testid` and ARIA role and name is preserved. Appearance and layout change; the contracts the e2e suite depends on do not.
- The `ready-ms` first-render bound holds.
- React Flow is styled only through its own CSS variables and class overrides. No fork of its `dist/style.css`.
- Both themes pass WCAG AA on body text and all interactive controls, including small meta text, against every ground each sits on.
- `npm run verify` (check:repo, check:dependencies, test, build, measure, test:e2e) passes before any phase is called done.

## Out of scope

Multi-reviewer pools, remote access, host round-trip board persistence beyond what already exists, generation chat on the canvas (generation stays in the CLI agents), and every "later phase" item until its trigger fires.

## Acceptance for the whole effort

- [ ] All fifteen issues in `.scratch/designmode-pivot/issues/` are `Status: done` with their acceptance lists checked.
- [ ] The four phase gates (issues 04, 10, 13, 15) each passed `npm run verify` at the time they closed.
- [ ] The desktop app matches `design/screens/*.html` and the mobile companion matches `design/screens/m-web/*.html`, both themes.
- [ ] `DECISIONS.md` records any deviation from `design/HANDOFF.md` agreed along the way.
