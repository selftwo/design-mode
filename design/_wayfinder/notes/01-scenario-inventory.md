# Research note — design-mode scenario inventory

Source: `~/Documents/design-mode` (React 18 + TS + Vite, React Flow default engine, Excalidraw adapter, local Node host). Facts only.

## Shell
- `src/app/App.tsx`; grid rows `56px / 1fr / 32px` (toolbar / canvas / status bar). Canvas region columns `1fr auto`; with local host `auto 1fr auto` (context pane left · canvas · comments panel right; agent rail floats over canvas).
- Token seam: `src/app/app.css` `:root` — ink/surface/canvas/border/accent/mark/danger/warn/ok/info + two radii + one shadow. No spacing scale, no type scale, no motion tokens, light only.

## Canvas
- One node type `screen` (`ScreenFrameNode.tsx`), no edges. Frame = screenshot + `.screen-label`, carries route/viewport/geometry/captureHash/revision/extracted `elements[]`.
- Zoom 0.25–2, pan on drag/scroll, dot-grid `Background gap=24`, React Flow `Controls`, **no minimap**. Camera persisted per board.
- Selection: select tool → annotation-at-point first, else frame; pane click clears; Enter/Space select or drop mark; arrows nudge 8/32px; Escape clears. Selected frame → `NodeResizer` (aspect-locked) only; **no inspector exists**.
- Element extraction: hover highlights smallest `FrameElement` (box + label); click creates/selects an `element` annotation.
- Marks: SVG overlay in normalized `0 0 1 1` — `circle`, freehand `path`, `element` rect; pinned comments = numbered `.comment-pin` buttons. Marks carry `data-stale`, `aria-pressed`, ordinal labels; selected mark paints last.

## Chrome
- Toolbar: title, engine badge, tools (select/circle/comment), engine switch, Projects link, Import images, Reset, Open/Exit live view.
- Left: Design context pane (host mode), **fixed 300px**, collapsible; tabs per file (DESIGN/PRODUCT/AGENTS/README) over raw `<pre>`.
- Right: Review comments panel, **fixed 320px**, collapsible — pooled annotation list; item = ordinal + subject + excerpt + intent chip + stale chip + Copy; selecting expands `AnnotationInstructionEditor` inline (textarea, status pills, 10 intent chips, Delete). Footer: Copy all, agent `<select>`, Send.
- Status bar (32px): counts, selections, focus state, ready-ms, save state, Delivered.
- Status banners: ad-hoc stack of 11 notice kinds (`role=alert/status`, dismiss ×).
- Reset dialog: native `<dialog>` showModal.
- Agent activity rail: floats over canvas; presence dot + up to 5 runs (queued/running/done/failed) + expandable `outputTail`; hidden when idle.
- Full-screen states: "Waiting for a board"; Project picker (list + register form; loading/empty/error).

## Flows
- Review: 10 intents (bolder quieter distill typeset layout colorize animate delight clarify harden), single-select per annotation. `buildReviewBatch()` → agent-neutral `AgentAnnotationSchema[]`, blocked on incomplete instruction or absolute screenshot path. Export states idle/delivering/delivered/blocked/error.
- Agent responses: host SSE (`run-updated`, `board-updated`, `capture-started/failed`) → activity rail; finished run → capture refresh → "Reload board" banner. Runs are never canvas comments today.
- Capture: register project → boot dev server → capture routes with element bounds; re-capture merges, revision advances only on hash change.
- Live view: proxied dev page in iframe inside the focused node; connecting/ready/unavailable chip; provenance-guarded messages; exit triggers refresh.
- Staleness: annotations store madeAgainstCaptureHash/revision; frame advance → `stale` mark + pill + chip.
- Image import: drag-drop or picker (png/jpeg/webp) → frames.

## Roadmap surfaces (not built)
1 redesign · 2 per-project vocabulary into chips/context · 3 blind compare surface (arena protocol in-product) · 4 teach mode (agent replies as canvas comments anchored to elements) · 5 verdict staleness · 6 image-probe review lanes · 7 more adapters + `design-mode` CLI · 8 desktop shell · 9 motion+sound.

## Hard constraints
- Gzip cap: React Flow route ≤ 140,617 × 1.2 bytes (`canvas-bundle-policy.mjs`); Excalidraw stays lazy.
- Zero new runtime deps (deps today: @xyflow/react, @excalidraw/excalidraw, react, react-dom, zod).
- Every `data-testid` + ARIA role/name preserved; `ready-ms` bound holds.
- React Flow styled only via its CSS variables/class overrides. Both themes AA.
