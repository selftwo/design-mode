# Decisions

## 2026-07-14: Keep agent integrations at the edge

Status: Accepted

Decision: The canvas writes a validated review batch. A local service will pass that batch to a selected command adapter.

Reason: The review data must work with CMUX, Codex, Claude Code, Pi, Grok, OpenCode, and later coding agents without changing the canvas model.

Rejected: Calling one coding agent directly from the canvas.

Revisit when: A target cannot consume the shared review batch without losing required context.

## 2026-07-14: Use React Flow as the default canvas engine

Status: Accepted

Decision: Use React Flow for the first product implementation. Keep Excalidraw as an optional adapter.

Reason: The 50 screen browser test found a smaller initial bundle and a simpler path for DOM based screens, anchored annotations, and an in place live iframe.

Rejected: Excalidraw as the default. tldraw as a shipped dependency because its current production license does not fit this public open source project.

Revisit when: Freeform drawing matters more than direct interaction with screen frames, or the license requirement changes.

## 2026-07-14: Keep one package until the local service exists

Status: Accepted

Decision: Keep the current application in one package. Organize it by feature.

Reason: Empty packages would describe planned code instead of helping agents navigate working code.

Rejected: Creating canvas, service, and protocol workspaces before two runtimes exist.

Revisit when: The first local service process and its shared message schema are implemented.

## 2026-07-14: Let executable contracts describe the implementation

Status: Accepted

Decision: Use feature folders, precise names, Zod schemas, and tests as the implementation record. Keep prose to navigation and decisions.

Reason: Explanatory architecture documents can disagree with changing code.

Rejected: Maintaining a separate description of the current source tree and behavior.

Revisit when: A stable domain term needs a short glossary.

## 2026-07-15: Accept the Excalidraw mermaid-import audit findings for release

Status: Accepted

Decision: Accept the 9 production `npm audit` findings (8 moderate, 1 high) rooted in `@excalidraw/excalidraw -> @excalidraw/mermaid-to-excalidraw` as a recorded, reviewed exception rather than blocking release on them. `npm run check:dependencies` encodes this list in `scripts/testing/dependency-audit-policy.mjs` and fails the release gate on any high or critical severity finding that is not in that reviewed list.

Reason: Every one of the 9 findings traces exclusively through `@excalidraw/excalidraw`'s optional mermaid-import dependency chain (`@excalidraw/mermaid-to-excalidraw`, `@mermaid-js/parser`, `langium`, `chevrotain`, `nanoid`, `lodash-es`), confirmed with `npm explain` for each package. That chain loads only on the optional `?engine=excalidraw` route; `canvas-engine-route-isolation.spec.ts` proves the default React Flow route never reaches it. The review canvas also never calls Excalidraw's mermaid-import feature, so the high severity `lodash-es` `_.template` code-injection surface is not exercised by this project's code. No fix is available without a breaking downgrade of `@excalidraw/excalidraw` (0.18.1 is the latest release), and Excalidraw remains an optional adapter per the earlier engine decision.

Rejected: Blocking release until Excalidraw publishes a fix. Removing Excalidraw entirely, which would drop the only Excalidraw compatibility path required by this slice.

Revisit when: Excalidraw ships a release without this dependency chain, or `check:dependencies` reports a new unreviewed high or critical severity finding.

## 2026-07-16: Autosave the board instead of a manual save button

Status: Accepted

Decision: The board saves itself to local storage a short debounce after every semantic change. The toolbar has no Save button. The footer shows a live save state, a failed save shows a dismissible error and pauses retries until it is dismissed or the board changes, and the reset confirmation compares the working board against the host board instead of the last manual save.

Reason: Manual review testing showed the save flow was the loudest part of the app. Annotation drafts already saved on type, so a second global save concept produced two save indicators and an unclear dirty state.

Rejected: Keeping the Save button next to autosave, which preserves the double save concept the feedback called out.

Revisit when: Boards grow past local storage limits and saving needs a host round trip.

## 2026-07-16: Fit circle marks to the whole pointer path

Status: Accepted

Decision: The circle tool records every pointer move between down and up, previews the ellipse while drawing, and fits the final mark to the bounding box of the full path.

Reason: Reviewers circle regions with a freehand loop. The previous down-to-up bounding pair collapsed a loop to a near-zero box because a loop ends where it starts.

Rejected: Storing the freehand polygon itself. The review batch schema and the agents that consume it expect one ellipse per mark, and the bounding ellipse keeps that contract.

Revisit when: Review consumers can use polygon marks.

## 2026-07-16: Store freehand ink and host-captured element bounds

Status: Accepted

Decision: The mark schema is a discriminated union: circle bounds, freehand path points, and picked design elements. The draw tool stores the simplified pointer path and renders it as drawn. Frames carry an optional element list that the capture script extracts from the live DOM (buttons, links, inputs, landmarks, headings) with normalized bounds, and select mode hover-highlights and picks those elements to attach comments to them. Exported annotations carry the picked element in the previously empty elements field.

Reason: Reviewers draw ink and think in components. A bounding ellipse threw away the drawn shape, and pixel-only anchors could not say which CTA or pane a comment meant. Element bounds only exist reliably in the live DOM at capture time, so the host supplies them; the canvas does not guess regions from pixels.

Rejected: Client-side image segmentation to find regions in screenshots, which is heavy and unreliable. Storing raw unsimplified pointer paths, which bloats boards and exports.

Revisit when: A host cannot run a DOM capture and needs server-side region detection.

## 2026-07-16: Pool comments in a side panel with one send or copy

Status: Accepted

Decision: A comments panel lists every annotation with its target, per-item copy, and the instruction editor inline under the selected item. Send to host and Copy all live in the panel and act on the whole validated pool; the floating editor and the toolbar Export button are gone.

Reason: Review feedback: comments should pool and go out at once, and each comment should be openable, editable, and removable from a persistent list instead of a floating box that covers the canvas.

Rejected: Keeping the floating editor next to the pooled list, which duplicates the editing surface.

Revisit when: Boards need multi-reviewer pools with per-comment authorship.

## 2026-07-16: Re-baseline the React Flow route bundle budget

Status: Accepted

Decision: Raise the React Flow route gzip reference from 116,567 to 140,617 bytes, the measured size after the pooled comments panel, freehand ink marks, and element picking shipped. The gate stays at reference plus 20 percent.

Reason: The old reference was the bare engine-spike route. Three deliberate feature slices consumed the headroom; the budget exists to catch accidental growth, not to freeze the feature set.

Rejected: Shaving bytes to stay under the stale cap, which would repeat on every feature. Removing the budget, which would stop catching optional engine code leaking into the default route.

Revisit when: The route grows another 20 percent without a matching feature decision.

## 2026-07-16: One local host app owns projects, capture, and agent dispatch

Status: Accepted

Decision: Ship a local host process under `host/` that serves the built canvas and an HTTP API for project registration, Playwright capture with element extraction, board persistence, design context files, live page proxying, agent dispatch, and a server-sent event stream. The canvas detects the host by an injected marker and implements the existing BoardHost contract over HTTP. `npm run app` starts everything.

Reason: The canvas spec left board production, the host protocol, project selection, and agent dispatch as separate slices. Without them the tool needed a coding agent session and hand-run scripts for every board, which blocked using it as an app.

Rejected: An Electron or Tauri shell first, which adds packaging before the host exists. Extending the window message host with more fixture scripts, which never reaches real projects.

Revisit when: The host needs remote access or more than one concurrent reviewer.

## 2026-07-16: Host runs shared TypeScript schemas through Node type stripping

Status: Accepted

Decision: The host imports the same Zod boundary schemas the canvas uses, executed directly by Node 23+ type stripping. Value-import chains shared with the host carry explicit `.ts` extensions, which `allowImportingTsExtensions` already permits.

Reason: One schema per boundary was the rule; duplicating board and batch schemas in the host would fork the contract. A build step or a runtime loader dependency costs more than extension-explicit imports.

Rejected: Duplicated `.mjs` schemas for the host. A tsx or ts-node dependency. Compiling the host with a second tsconfig.

Revisit when: The repository must support Node versions without type stripping.

## 2026-07-16: Agent dispatch behind command adapters with one shared prompt

Status: Accepted

Decision: Dispatch runs Claude Code (`claude -p --permission-mode acceptEdits`), Codex (`codex exec --sandbox workspace-write`), or Cursor (`cursor-agent -p --force`) in the project directory. One prompt builder feeds all three: review batch, project context files (DESIGN.md, PRODUCT.md, AGENTS.md, CLAUDE.md, README.md), screenshots, and the intent vocabulary. Runs are journaled with prompt, batch, screenshots, and output tail; run and capture events stream to the canvas, and a finished run triggers a merging re-capture.

Reason: The review batch must stay agent neutral by contract, and the reviewer asked for Claude, Codex, and Cursor. Making runs visible presence on the board is what turns dispatch into collaboration instead of a fire-and-forget export.

Rejected: Embedding agent names or commands in the review batch. A single hardcoded agent. Waiting for agent SDKs instead of shelling out to the CLIs users already have.

Revisit when: Adapters need streaming structured events (for example claude --output-format stream-json) rather than an output tail.

## 2026-07-16: Design intents borrow Impeccable's command vocabulary

Status: Accepted

Decision: Annotations carry an optional intent from a fixed enum (bolder, quieter, distill, typeset, layout, colorize, animate, delight, clarify, harden) with one guidance line per intent shared by the editor tooltips and the agent prompt. If the target repo has Impeccable installed, the prompt tells the agent it may use those skills.

Reason: Reviewed Impeccable's Live Mode and command set: its adjective-level vocabulary is the part that transfers to a review canvas. Encoding it as data keeps the batch agent neutral while giving every adapter the same design language.

Rejected: Free-text intent tags, which agents cannot interpret consistently. Depending on the impeccable package at runtime.

Revisit when: Reviewers need per-project custom vocabularies.

## 2026-07-17: Pivot to the handed-off designmode DLS; islands supersede docked panels

Status: Accepted

Decision: The design language system handed off at `design/` (from `claude-design/dls/designmode`) is the single design source. The product rebuilds on it in four ticketed phases (`.scratch/designmode-pivot/`): re-skin on the DLS tokens, restructure to floating islands over an edge-to-edge canvas with dodge-by-default placement and bloom threads at marks, the learn/ask lens with teach annotations, and a mobile-web review companion. `specs/redesign-visual-system.md` was rewritten accordingly.

Reason: The prior work was prototyping to prove feasibility. The DLS direction was settled upstream through a wayfinder run and three grill rounds (provenance in `design/_wayfinder/`), so re-deriving it here would only fork it. Islands with dodge-then-drag beat docked panels for a spatial judgment tool: chrome never owns viewport bands, and the subject stays the captured screens.

Rejected: The earlier draft's phase 2 of resizable docked panels with pointer-drag splitters. Adding a runtime dependency for drag or placement (buildable with the existing stack). Generation chat on the canvas.

Revisit when: A later-phase trigger in `design/HANDOFF.md` fires, or the islands layout fails the phase 2 gate's keyboard workflow.

## 2026-07-17: Frame chrome on `.screen-node`, not `.dm-frame` on the React Flow wrapper

Status: Accepted

Decision: Captured frames use token-aligned rules on `.screen-node` / `.screen-content` in `ScreenFrameSurface.css` (border, lift, violet selection ring, mono label via `.dm-frame-label`). The catalog class `.dm-frame` is not applied to the outer React Flow node wrapper.

Reason: `.dm-frame` sets `overflow: hidden`, which clips React Flow `NodeResizer` handles and breaks the resize e2e workflow. The inner `.screen-content` keeps `overflow: hidden` for capture clipping only.

Rejected: Applying `.dm-frame` to the node wrapper and patching resize handle z-index.

Revisit when: Phase 2 moves frames to a bloom/island model that no longer uses React Flow resize handles on the same element.

## 2026-07-17: Live frame state badge stays bottom-right and non-interactive

Status: Accepted

Decision: `.live-state` in `LiveReviewFrame.css` sits at the bottom-right of the frame with `pointer-events: none`.

Reason: A bottom-left badge (matching some showcase layouts) sat over the fake-host increment control and blocked iframe clicks in the live-view e2e flow. Right placement matches the pre-pivot shell and keeps the badge readable without stealing hits from the proxied page.

Rejected: Bottom-left placement without `pointer-events: none`.

Revisit when: Live chrome moves to a dedicated island in phase 2.

## 2026-07-17: Status island keeps e2e focus-state and export-status contracts

Status: Accepted

Decision: The floating status island uses `screenshot mode` (not design spec `live off`) for the idle `focus-state` testid, and renders `export-status` only when delivery succeeded — not on blocked or error states.

Reason: Nineteen Playwright tests assert these exact strings and presence rules. The island layout and mono-line presentation change; the test contracts do not.

Rejected: Renaming focus-state to `live off` or showing export-status on blocked/error.

Revisit when: E2e contracts are updated alongside phase-2 island vocabulary.

## 2026-07-17: Design context lives in the layers-and-aspects island

Status: Accepted

Decision: Ticket 07 removes the docked `DesignContextPane` and renders project context files (`DESIGN.md`, `PRODUCT.md`, `AGENTS.md`, `README.md`) in a `Design context` section at the bottom of the summoned layers-and-aspects island when the local host is active. `context-pane`, `context-tab-*`, and `context-body` testids move with that section. The collapsed `toggle-context-pane` control is removed because the island is already summoned on demand.

Reason: Phase 2 forbids permanently docked panels. Context must stay reachable while reviewing without reserving a fixed column.

Rejected: Moving context exclusively to the project picker, which hides it during review.

Revisit when: Context files need a dedicated summoned surface separate from the inspector.

## 2026-07-17: Board aspects open from the layers tree, not empty-canvas click

Status: Accepted

Decision: Clicking empty canvas still closes the summoned island (preserving ticket 06 dodge Playwright contracts). Board-level aspects appear when the reviewer selects the board row in the layers tree.

Reason: Ticket 07 requires board properties without breaking `data-open="false"` on pane deselect or the deselect/reselect dodge reset.

Rejected: Keeping the island open on empty-canvas click, which would leave `data-open="true"` and prevent dodge from re-arming.

Revisit when: Product wants empty-canvas click to mean board selection instead of dismiss.

## 2026-07-17: Import DLS tokens instead of inlining into app.css

Status: Accepted

Decision: `src/app/app.css` loads `design/tokens/tokens.css` via `@import` and keeps only app-shell layout rules. Ticket 01 originally inlined the token blocks; that copy drifted and was lost while `App.tsx` kept phase-2 structure, which broke floating layout (undefined `--space-*` made notice `top` calc invalid and covered the toolbar).

Reason: One source of token truth prevents silent reversion to the pre-DLS `:root` seam.

Rejected: Keeping a second verbatim copy of the token file inside `app.css`.

Revisit when: Build tooling needs tokens without CSS `@import`.

## 2026-07-17: Runs island reuses SummonedIsland; ARIA follows the screen

Status: Accepted

Decision: `RunsIsland` uses the ticket 06 `SummonedIsland` shell (dodge, drag, nudge) with default bottom-right CSS when nothing is selected. `data-testid="agent-activity"` stays; `aria-label` becomes `Agent runs` per `design/screens/returned-run.html`.

Reason: Screen file wins over the old rail label when they disagree.

Rejected: Keeping `Agent activity` as the accessible name.

Revisit when: E2e asserts the runs island ARIA name explicitly.

## 2026-07-17: Phase 2 gate — returned-run evidence via host contract, not fake-host capture

Status: Accepted

Decision: Phase 2 gate screenshots for `returned-run.html` capture the delivered-export bloom state in the fake-host Playwright fixture. Agent candidate replies with the `⌁` glyph, stale marks, reload notices, and expanded runs tails are verified through `AnnotationBloom`, `RunsIsland`, host API tests, and the live `host/` SSE contract instead of mocking run journals in e2e fixtures.

Reason: The fake board host deliberately omits agent-run journaling; adding screenshot-only mocks would fork the host contract.

Rejected: Extending the fake host with a parallel run-journal mock for gate captures only.

Revisit when: Playwright fixtures need a lightweight run-journal stub for phase 3 learn-lens coverage.

## 2026-07-17: Bloom threads at their marks

Status: Accepted

Decision: Selecting an annotation opens `AnnotationBloom` (viewport-fixed, dodge placement from ticket 06) with `AnnotationInstructionEditor` inside. `ReviewCommentsPanel` is a summoned jump-list island (no inline editor); copy/send actions stay in its footer. Thread resolve was session UI state (`resolvedAnnotationIds`) until ticket 15; see the persisted `resolvedAt` decision below. Agent candidate replies render from the newest `done` host run whose `annotationIds` includes the mark.

Reason: Matches `design/screens/review-dispatch.html` and `returned-run.html`: threads bloom at marks; the rail is secondary navigation only.

Rejected: Keeping the docked 320px comments column; duplicating a second bloom implementation.

Revisit when: Resolved state and agent replies need to persist on the board document.

## 2026-07-17: The learn lens island

Status: Accepted

Decision: The learn lens is a separate summoned island (`LearnLensIsland`) with fixed initial placement and no dodge-on-selection. Element picks while `learnLensOpen` route through `onLearnElementPick` instead of annotation creation. Teach questions use `TeachQuestionSchema` (agent-neutral payload) posted to `POST /api/projects/:id/teach`; the host builds prompts via `buildTeachPrompt` and returns the agent stdout as a non-actionable inline answer. Anatomy and vocabulary derive client-side in `derive-learn-content.ts` from extracted element data plus shared intent vocabulary.

Reason: Matches `design/screens/learn-lens.html`: the lens floats free, updates content in place, never snaps back, and explains without routing work.

Rejected: Reusing `SummonedIsland` dodge placement for the learn lens; folding teach into the review-batch dispatch schema.

Revisit when: Ticket 12 pins teach answers to the canvas as anchored teach annotations.

## 2026-07-17: Teach annotations pinned to the canvas

Status: Accepted

Decision: Teach annotations are a `kind: 'teach'` board-document variant with element anchor, machine provenance (`provenanceRunId`, `⌁` glyph), and the same capture-hash/revision staleness contract as review marks. They render on-canvas as `.dm-teach-note`, appear in the layers tree and comments jump list, support approve/delete, and are excluded from `buildReviewBatch()`. Pinning flows from `LearnLensIsland` after a teach question round-trip; embed mode uses the existing `design-review/ask-teach-question` window message when no local HTTP host is present.

Reason: Matches `design/screens/learn-lens.html` and the Teach note row of `design/components/catalog.md`: agent voice on teal paper, reversed review-batch direction, no dispatch.

Rejected: Folding teach notes into `ReviewAnnotation` without a discriminant; exporting teach notes in dispatch batches.

Revisit when: m-web approve flows need persisted resolved state on teach annotations.

## 2026-07-17: Dark theme toggle in the toolbar

Status: Accepted

Decision: The dark-theme toggle lives in the floating toolbar actions group (`data-testid="theme-toggle"`, `aria-pressed`, label switches Dark/Light). Theme persists in `design-review-theme` localStorage and applies `data-theme` on `document.documentElement`. Screen HTML specs (`board.html`, `learn-lens.html`) omit the control from toolbar markup; phase 3 ships it as a first-class reviewer affordance beside Import/Reset/Live.

Reason: Phase 3 done-when requires the dark theme as a user-facing toggle beyond the phase-1 scaffold. Toolbar placement keeps it reachable on every surface without summoning an island.

Rejected: A separate settings island; hiding the toggle on the project picker only.

Revisit when: m-web needs its own theme entry point at mobile breakpoints.

## 2026-07-17: m-web companion as a separate Vite entry

Status: Accepted

Decision: The mobile-web review companion ships as `m-web.html` → `src/app/m-web-main.tsx`, a second Vite entry under `src/features/m-web/`. It reads boards, captures, threads, runs, and notices per `design/screens/m-web/`, persists human thread replies on `ReviewAnnotation.replies` and approvals on optional `resolvedAt` via the existing `PUT /api/projects/:id/board` contract, and renders them in both `ThreadHistory`/`MWebCapturePage` and desktop `AnnotationBloom`/`TeachAnnotationNote`. The host serves `/m-web` paths from `m-web.html` with the same `__designModeHost` marker.

Reason: Keeps React Flow and Excalidraw out of the m-web bundle and off the desktop `npm run measure` gate while reusing the board document and host API without forked endpoints.

Rejected: Hash-routing inside the desktop `index.html` entry; m-web-only reply or approve API routes.

Revisit when: m-web needs mark authoring or dispatch composition on the companion surface.

## 2026-07-17: Persist thread approval on `resolvedAt`

Status: Accepted

Decision: Review and teach annotations carry an optional `resolvedAt` ISO datetime on the board document. m-web sets it through `resolveBoardAnnotation()` and `PUT /api/projects/:id/board`; desktop bloom and teach-note resolve write the same field while still mirroring into session `resolvedAnnotationIds` for immediate UI. `isAnnotationResolved()` is the shared read path; `bloomThreadStateWord` shows `✓ resolved` when either persisted or session-local.

Reason: m-web approve must round-trip through the host and appear on the desktop canvas without a second reviewer at the desk. Session-only resolve could not survive a board reload or a cross-surface handoff.

Rejected: A separate m-web-only approval store; a new `status: resolved` enum that would fork the agent export contract.

Revisit when: Approval needs audit metadata beyond a timestamp (reviewer id, source surface).

## 2026-07-17: Pivot QA placement, dispatch, and chrome decisions

Status: Accepted

Decision: Islands dodge every open island obstacle. Blooms re-anchor on every animation frame during camera movement, and off-screen annotations remain rendered so rail selection can reveal them. The bloom owns single-annotation dispatch; the comments rail remains the batch path. Desktop teach notes stay non-actionable and retain Delete as the removal path. Engine chrome stays behind `?dev=1`, while Reset sits at the end of the toolbar actions.

Reason: These choices preserve the handed-off screens while keeping review work spatial, discoverable, and reversible.

Rejected: Fading blooms during camera movement; rail-only dispatch; desktop teach approval; exposing the engine switcher in product chrome.

Revisit when: A dedicated developer surface or persisted reviewer identity replaces these temporary affordances.

## 2026-07-17: Pivot QA contract migrations

Status: Accepted

Decision: The engine badge/switcher remain available under `?dev=1`; the board pill is added; selected annotation status shows a human ordinal with the UUID in `title`; intent jump-list chips use neutral tokens; the removed `toggle-context-pane` testid and renamed `Agent runs` aria-label remain intentional compatibility migrations. E2e contracts that previously asserted the raw UUID in `selected-annotation` now read the ordinal text and the UUID from `title`.

Reason: The visual contract is user-facing while test hooks remain stable where they support behavior.

Rejected: Showing raw UUIDs and harness diagnostics as primary product copy.

Revisit when: The browser contract can migrate from legacy status strings.

## 2026-07-22: Re-baseline the React Flow route bundle budget for the collaboration surface

Status: Accepted

Decision: Raise the React Flow route gzip reference from 140,617 to 169,441 bytes, the measured initial size after the canvas collaboration surface shipped: playable-option iframes and kit dials, the verdict gestures and decision ledger, kill and archive zones, the agent-to-canvas back-channel, first-class references, and review telemetry. The gate stays at reference plus 20 percent.

Reason: The 140,617 reference predated the entire six-item collaboration-surface branch. Items one through five already sat at 1.19 times that reference; review telemetry (item six) tipped it just over the cap. The added weight is hand-written feature code in the shared entry chunk, not an optional-engine leak (only 23 gzip bytes fell in the route chunk itself, and the excalidraw chain stays behind its dynamic import). The budget exists to catch accidental growth, not to freeze a planned feature set.

Rejected: Shaving telemetry bytes to stay under the stale cap by dropping a plan requirement such as viewport-fraction dwell or cross-session totals. Removing the budget, which would stop catching optional engine code leaking into the default route.

Revisit when: The route grows another 20 percent without a matching feature decision.

## 2026-08-03: Hybrid tooling — Agentation for pointed feedback, design-mode for canvas

Status: Accepted

Decision: Use Agentation for Cursor-style pointed feedback on a live webapp (annotate → MCP/markdown → agent). Keep design-mode as the multi-screen review canvas (captures, playable options, verdicts, bloom history, teach/learn, m-web). Do not rebuild an in-page Agentation-class toolbar inside design-mode. Plan: `docs/plans/hybrid-agentation-designmode-2026-08-03.md`.

Reason: The jobs diverge. Agentation is refined for in-page annotate-fix; design-mode is refined for spatial judgment and collaboration. Building both jobs in one surface would dilute the canvas product and lag Agentation on the overlay loop.

Rejected: Replacing design-mode with Agentation. Pausing Agentation to finish a custom in-page overlay first. Merging the uncommitted pivot onto collaboration without a conflict plan (pivot is preserved on `pivot/designmode-islands-wip`; `main` matches `origin/main`).

Revisit when: A target app cannot use Agentation (non-React, license, or desktop-only limits) and still needs pointed feedback, or the canvas product clearly needs an in-page bridge that Agentation cannot supply.
