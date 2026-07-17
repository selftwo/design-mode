# Designmode: dev takeover handoff

This document hands the rest of designmode's development to whoever builds it next, human or agent, working in the production repo at `~/Documents/design-mode`. This DLS folder (`dls/designmode/`) is the design source of truth. Read this file first, then use `tokens/`, `components/catalog.md`, `showcase.html`, `screens/`, and `screens/m-web/` as the screen-by-screen spec.

## What designmode is

Designmode is a personal design review canvas. It holds captured screens from other products on a spacious canvas. The reviewer marks a screen, attaches an intent (bolder, quieter, distill, and so on), and dispatches the mark to a coding agent running in a CLI. The agent works on the real codebase and replies; its reply lands back on the canvas as an anchored comment. When the agent has made a change, the reviewer refreshes a local dev server to see it inline. There is no generation chat on the canvas itself: the canvas is for spatial judgment and marking, generation stays with the agents. A second, hidden lens teaches: the reviewer clicks an element, sees its anatomy and the vocabulary that names it, asks one question, and the answer lands as an anchored teach annotation carrying the `⌁` provenance glyph that marks anything machine-authored.

## The design direction (binding)

The canvas is edge to edge, full viewport, with a dot grid. All chrome floats over it as islands: a toolbar, a status strip, a runs island, and a combined layers-and-aspects island. No panel is docked or permanent. A panel appears only when summoned by a selection or an invoked tool.

Interaction rules that hold across every surface:

- **Dodge by default, drag wins.** A summoned island places itself so it never covers the current selection. If the reviewer drags an island to a new spot, that placement is remembered for the session and the island stops auto-dodging until deselected and reselected.
- **Threads bloom in place.** A comment thread opens directly at the mark on the canvas, not in a side rail. The rail, where one exists, is a jump list only.
- **The learn lens floats free.** It is a draggable, closable island. Clicking a different element while it is open updates its content in place; it never snaps back to a default position.
- **One hue, one job.** Violet is the tool's own signal (selection, pressed state, focus, active tool). Coral is reserved for review annotations. Teal is reserved for the teach lens. Green is reserved for run states. No hue does double duty, and no material borrows another material's hue.
- **The aspects panel speaks CSS.** When an element is selected, the aspects side of the layers-and-aspects island shows Layout, Flex, Radius, Fill (as a swatch plus its named token), Border, and Type sections, in the product's own terms, not abstract geometry.

Both themes ship: light is default; dark exists because captured screens are often light-colored themselves, and a dark tool chrome keeps them legible and lets them read as the subject rather than blending into the tool. Exact values, both themes, live in `tokens/tokens.css`; the component inventory that consumes them lives in `components/components.css` and is described in `components/catalog.md`; both themes with every component and realistic content render in `showcase.html`. Screen-by-screen states for every surface listed below live in `screens/`, and the simplified mobile-web review experience lives in `screens/m-web/`. Treat all four as the spec: if this document and a screen file disagree on a detail, the screen file wins.

## Feature and functionality list

### Core

- **Canvas shell.** Edge-to-edge pan-and-zoom surface, dot grid, zoom range 0.25 to 2, camera position held per board. No minimap. Toolbar and status strip float as islands rather than docking to fixed pixel bands.
- **Capture frames.** A captured screen renders as a physical object on the canvas: edge, lift, mono label, and a signal ring when selected. A frame carries its route, viewport, geometry, capture hash, revision, and any extracted elements. Uses `.dm-frame` / `.dm-frame-label`.
- **Marks.** Circle, freehand, and element marks sit on an SVG overlay in normalized coordinates over each frame. Marks are numbered, carry `data-stale` and `aria-pressed`, and the selected mark paints last (on top).
- **Bloom threads.** Selecting a mark opens its comment thread in place at the mark, not in a side panel. A thread header shows a state word and, for machine-authored entries, the accent-filled agent avatar and the `⌁` glyph. Uses `.dm-comment` family plus the anchor and state-dot vocabulary from the review annotation patterns.
- **Intent chips.** Ten dispatchable intents (bolder, quieter, distill, typeset, layout, colorize, animate, delight, clarify, harden), single-select per annotation. At rest they sit in a sunken fill; chosen state is a signal fill. Uses `.dm-chip`.
- **Dispatch.** `buildReviewBatch()` collects marked, intent-tagged annotations into an agent-neutral batch and sends it to a chosen agent. States: idle, delivering, delivered, blocked (incomplete instruction, or an absolute screenshot path that cannot resolve), error.
- **Returned runs.** An agent run reports back over SSE (queued, running, done, failed) and, on completion, triggers a capture refresh and a "reload board" notice. Runs remain visible as history even when idle.
- **Layers and aspects island.** One summoned island holds both a layers tree (selection synced both ways with the canvas, hover-to-outline) and, for the current selection, the CSS-speaking aspects sections described above. Empty selection shows board-level properties; nothing selected hides the aspects side.
- **Runs island.** A floating list of active and recent agent runs: presence dot, what each run is doing, run id in mono, expandable output tail. Uses `.dm-agent-row`, `.dm-dot`.
- **Status.** A thin strip reporting frame id, selection count, zoom, save state, and delivery state as plain words, no icons standing in for text. Uses `.dm-statusbar`.

### Differentiating

- **Learn / ask lens.** A hidden, invoked-on-demand floating panel. Clicking an element while it is open shows that element's anatomy: what it is, how it is structured, and the vocabulary term for it. The reviewer can ask one question; the agent's answer appears inside the lens, non-actionable (it explains, it does not generate or dispatch a change). The lens is draggable by its header, closable, and keyboard-nudgeable when focused.
- **Teach annotations.** When an agent answers a question asked through the learn lens, the answer can also land as an anchored comment on the canvas at the clicked element, in the teal teach hue, carrying the `⌁` provenance glyph. This is the same review-batch contract as a dispatched fix, reversed: the agent annotates for the human instead of the human annotating for the agent. Neither Paper.design nor Pencil.dev, the two closest reference tools, has an equivalent teach affordance; it is designmode's own move.

### Supporting

- **Compare.** Two captures or live frames side by side for a visual pick, not yet built; see "Blind compare, in product" under later phases.
- **Stale handling.** An annotation records the capture hash and revision it was made against. When the frame advances past that revision, the mark and its chip both flip to a stale state: neutral border-strong, never alarmist red.
- **Notices.** One notice component renders every banner kind (info, warn, error, success) with a consistent position, a dismiss control, and an optional action slot.
- **Dialog flows.** Blocking confirmations (for example, board reset) use a native `<dialog>` with a scrim, entering with the one settle motion. Nothing else on the canvas blocks.
- **Onboarding.** Full-screen states for "waiting for a board" and the project picker (list, register form, loading, empty, error).
- **Live view.** A proxied dev-server page renders inside the focused frame with connecting, ready, and unavailable states; exiting live view triggers a refresh.
- **Image import.** Drag-drop or file picker (png, jpeg, webp) creates new frames directly, without a capture pass.

### m-web

The mobile-web review experience is a simplified, decluttered subset for reading and responding to a review already in progress, not for authoring it.

- Reading and replying to threads: open a bloomed thread, read its history, add a reply.
- Approving: accept a returned change or a teach annotation without needing the full island layout.
- Not included: mark authoring, frame capture, dispatch composition, the layers-and-aspects island. m-web is a review companion, not a second copy of the desktop tool.

## Roadmap

Each phase states its scope, when it counts as done, and how to verify it. Run `npm run verify` (which chains `check:repo`, `check:dependencies`, `test`, `build`, `measure`, `test:e2e`) before calling any phase complete.

### Phase 1: re-skin

**Scope.** Replace the `:root` block in `src/app/app.css` with the DLS token set from `tokens/tokens.css`. The DLS token set is a strict superset of the existing seam: `--ink`, `--surface`, `--canvas`, `--border`, `--accent`, `--mark`, `--danger*`, `--warn*`, `--ok*`, `--info*`, `--radius-control`, `--radius-panel`, `--shadow-panel` keep their names and meaning; the DLS adds the spacing scale, the type scale, motion tokens, sub-roles, and the dark theme block. Sweep every component CSS file so no literal font size, spacing value, or one-off hex remains outside the token block. Restyle each existing component in isolation against the DLS classes in `components/catalog.md`: toolbar, comments panel, instruction editor, context pane, activity rail rows, project picker, live frame chrome, reset dialog, status bar. Redraw inline SVG icons to the DLS stroke style. Add a `[data-theme="dark"]` toggle, persisted alongside the existing collapsed-panel state.

**Done when.** Every surface renders on DLS tokens in both themes. No component CSS file has a literal color, font size, or spacing value outside the token block. Every `data-testid` and ARIA role and name from the current app is unchanged.

**Verify.** `npm run verify` passes with no test edits beyond additions. `npm run measure` holds the gzip bundle cap. Both themes checked against WCAG AA for body text and controls. Before-and-after captures of the five main surfaces (picker, board, annotation editing, live view, dispatch) reviewed side by side on the canvas itself.

### Phase 2: restructure

**Scope.** Replace the fixed docked panels (300px context pane, 320px comments panel, fixed 56/32px toolbar and status bands) with the islands layout: toolbar and status as thin floating strips, layers-and-aspects and runs as summoned islands. Implement dodge-by-default placement against the current selection, plus drag-to-reposition that overrides dodge for the rest of the session. Move comment threads from the panel-bound list onto the canvas as bloom threads anchored at their marks; keep a jump-list rail as a secondary way to reach a thread, not the primary one.

**Done when.** No panel is permanently docked. Selecting an element or a frame summons the relevant island without covering the selection. Dragging an island holds its position across further selections in the same session. A bloomed thread opens at its mark and matches the anchor and state-dot vocabulary from `components/catalog.md` and the annotation research.

**Verify.** `npm run verify`. Add Playwright coverage: drag an island and assert its position persists across a new selection with no snap-back; select a centered element and assert the dodge behavior places the island sensibly, not off-canvas.

### Phase 3: differentiators

**Scope.** Build the learn/ask lens: a floating, draggable, closable panel that shows an element's anatomy and vocabulary on click, and renders one asked question and its agent answer inline, non-actionable. Wire teach annotations: an agent answer can also be pinned to the canvas as an anchored comment in the teal teach hue with the `⌁` provenance glyph, using the same review-batch contract as a dispatched fix, reversed in direction. Ship the dark theme as a first-class, user-facing toggle if it was only scaffolded in phase 1.

**Done when.** The learn lens opens on demand, is fully draggable and closable, updates content on each new element click without moving itself, and a question asked inside it produces a teach annotation on the canvas when the reviewer chooses to pin it.

**Verify.** `npm run verify`. Add Playwright coverage: open the lens, drag it, click a second element, assert content updates and position holds; assert a pinned answer appears on the canvas with the `⌁` glyph and the teal hue.

### Phase 4: m-web

**Scope.** Build the simplified mobile-web review companion: reading and replying to threads, approving returned changes and teach annotations. No mark authoring, no capture, no dispatch composition, no layers-and-aspects island on this surface.

**Done when.** The m-web surfaces in `screens/m-web/` render correctly at mobile-web viewport widths, thread reading and reply and approve flows work end to end against the same host and review-batch contract as desktop, and nothing from the authoring toolset is reachable from this surface.

**Verify.** `npm run verify` plus a manual or Playwright pass at the mobile-web breakpoints represented in `screens/m-web/`.

### Later phases (from the product roadmap)

These are not scoped in this handoff. Each graduates into its own spec in `~/Documents/design-mode/specs/` when its trigger is met, following the existing `specs/redesign-visual-system.md` format (problem statement, solution, constraints, acceptance).

- **Per-project vocabulary.** Intent chips load from the target project's own DESIGN.md terms plus the shared working vocabulary, and the context pane surfaces a taste-source file such as `taste/DISTILLATION.md` when the target repo has one. Trigger: reviewers need per-project custom vocabularies.
- **Blind compare, in product.** Two captures or live frames side by side, sides assigned by id hash, pick with ties allowed, one reason per pick, discipline chips, technical gates run on both sides before a pick is asked. The arena protocol at `claude-design/arena/README.md` is the reference implementation. Trigger: the arena workflow is needed inside the tool rather than as a separate run.
- **Verdict staleness.** Recorded picks and compare results age the same way captures do; an old verdict prompts a fresh blind label instead of being reused silently. Trigger: ships alongside or after blind compare.
- **Image probe review.** Import generated visual-direction probes as frames, compare them on the blind surface, mark the approved lane, and dispatch implementation referencing the pick. Trigger: after blind compare exists.
- **More adapters, invoke from anywhere.** Additional agent adapters (Grok, CMUX, Pi, OpenCode) behind the same quarantine as existing adapters, plus a single `design-mode` CLI entry that boots the host and opens the browser from any directory. Trigger: a second agent besides the current default is needed in daily use.
- **Desktop shell.** Wraps the host once the workflows above are stable. Trigger: the host itself is stable enough to wrap.
- **Motion and sound.** DLS motion tokens applied to canvas transitions; at most one sound, on the signature act, per the taste laws. Trigger: after the core interaction surfaces (phases 1 to 4) are stable.

## Hard constraints

These hold for every phase, without exception:

- **Gzip bundle cap.** The React Flow route must stay at or under its reference size times 1.2, enforced by `scripts/testing/canvas-bundle-policy.mjs` (`npm run measure`). The Excalidraw adapter stays lazy-loaded and out of the default bundle.
- **Zero new runtime dependencies.** The dependency set stays `@xyflow/react`, `@excalidraw/excalidraw`, `react`, `react-dom`, `zod`. Do not add a new runtime package to implement any part of this direction; islands, dodge, drag, and bloom threads are all buildable with the existing stack.
- **Every `data-testid` and ARIA role and name is preserved.** The re-skin and the restructure change appearance and layout, not the contracts the e2e suite and any external tooling depend on.
- **The `ready-ms` first-render bound holds** through every phase.
- **React Flow is styled only through its own CSS variables and class overrides.** Do not fork or patch `dist/style.css`.
- **Both themes pass WCAG AA** on body text and all interactive controls, including small meta text, checked against every ground it sits on, not only its own panel.

## Provenance

The decisions this document states as binding were settled through a wayfinder run and three grill rounds, not invented for this handoff. For the reasoning behind any of them:

- `_wayfinder/map.md` holds the outcome, the settled list, and the frontier note tracing how the direction was chosen.
- `_wayfinder/notes/01-scenario-inventory.md` is the factual survey of the production repo this document's feature list is drawn from.
- `_wayfinder/notes/02-annotation-patterns.md` is the source for the thread, chip, and provenance-glyph vocabulary.
- `_wayfinder/notes/03-canvas-and-panel-precedent.md` is the source for the islands-over-canvas precedent and the Figma-style layers-and-aspects anatomy.
- `_wayfinder/notes/04-paper-pencil.md` is the source for the claim that the teach lens has no equivalent in Paper.design or Pencil.dev.
- `_wayfinder/grill/TONE-3.md` is the source for the exact palette doctrine (hue-per-job, the violet signal, the rejected alternatives) and the interaction upgrades (draggable lens, movable furniture, dodge-then-drag-wins).
