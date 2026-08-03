# 02: Sweep every component CSS file onto the DLS

Status: done
Type: task
Phase: 1 (re-skin)
Blocked by: 01
Spec: specs/redesign-visual-system.md

Read first: design/components/catalog.md, design/components/components.css, design/showcase.html (open it in a browser, both themes).

## What to build

Restyle each existing component in isolation against the DLS component classes, and remove every literal font size, spacing value, and one-off hex from component CSS so only the token block carries raw values.

Surfaces to restyle, each against its catalog row:

- `src/features/review-board/ReviewToolbar.tsx` — toolbar anatomy (`.dm-toolbar` vocabulary; still docked for now, islands land in phase 2).
- `src/features/review-board/ReviewCommentsPanel.css` — list rows, comment entries, intent chips (`.dm-row`, `.dm-comment`, `.dm-chip`).
- `src/features/review-board/AnnotationInstructionEditor.css` — inputs, field labels, buttons (`.dm-input`, `.dm-textarea`, `.dm-btn`).
- `src/features/local-host/DesignContextPane.css`, `AgentActivityRail.css` (`.dm-agent-row`, `.dm-dot`), `HostProjectPicker.css` (`.dm-list`, `.dm-row`).
- `src/features/live-review/LiveReviewFrame.css` and `LiveFrameHostConnecting.tsx` chrome.
- `src/features/review-board/ReviewBoardResetDialog.css` (`.dm-scrim`, `.dm-dialog`, the `dm-settle` entrance).
- The status bar (`.dm-statusbar`, mono, tabular numerals) and notices (`.dm-notice`, tone changes color only).
- `src/features/review-board/FrameAnnotationMarks.css` and `engines/react-flow/ScreenFrameSurface.css` — marks are coral (`.dm-mark` family), frames are physical objects (`.dm-frame`, `.dm-frame-label`, violet selection ring).

React Flow itself is styled only through its CSS variables and class overrides.

## Done when

- [x] No component CSS file has a literal color, font size, or spacing value outside the token block (`rg '#[0-9a-fA-F]{3,8}|font-size:\s*\d|\b\d+px' src --glob '*.css'` returns only the token block and justified geometry like border widths).
- [x] Each listed surface visually matches its catalog row in both themes.
- [x] Every `data-testid` and ARIA role/name is unchanged; e2e passes without edits.

## Verify

`npm run verify`. Compare each surface against design/showcase.html side by side, both themes.

## Comments

- Imported `design/components/components.css` from `src/app/main.tsx`; wrapped shell in `.dm`.
- Swept all nine component CSS files onto spacing/type tokens; zero hex or `font-size: N` literals remain outside `src/app/app.css` token blocks (border-width px only).
- Applied DLS classes across toolbar, comments panel, instruction editor, context pane, activity rail, project picker, live frame chrome, reset dialog, status bar, notices, marks, and frames.
- React Flow: `--xy-*` overrides in `ScreenFrameSurface.css`; dot grid uses `var(--border-strong)`.
- Frame chrome uses token rules on `.screen-node` (not `.dm-frame` on the wrapper — see DECISIONS.md) so resize handles stay visible.
- Live-state badge: bottom-right, `pointer-events: none` (see DECISIONS.md).
- `npm run verify` — **pass** (126 unit, 19 e2e).
- `npm run measure` — reactflow gzip **150,968 B** (cap 168,740 B).
