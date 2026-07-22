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

## 2026-07-22: Re-baseline the React Flow route bundle budget for the collaboration surface

Status: Accepted

Decision: Raise the React Flow route gzip reference from 140,617 to 169,441 bytes, the measured initial size after the canvas collaboration surface shipped: playable-option iframes and kit dials, the verdict gestures and decision ledger, kill and archive zones, the agent-to-canvas back-channel, first-class references, and review telemetry. The gate stays at reference plus 20 percent.

Reason: The 140,617 reference predated the entire six-item collaboration-surface branch. Items one through five already sat at 1.19 times that reference; review telemetry (item six) tipped it just over the cap. The added weight is hand-written feature code in the shared entry chunk, not an optional-engine leak (only 23 gzip bytes fell in the route chunk itself, and the excalidraw chain stays behind its dynamic import). The budget exists to catch accidental growth, not to freeze a planned feature set.

Rejected: Shaving telemetry bytes to stay under the stale cap by dropping a plan requirement such as viewport-fraction dwell or cross-session totals. Removing the budget, which would stop catching optional engine code leaking into the default route.

Revisit when: The route grows another 20 percent without a matching feature decision.
