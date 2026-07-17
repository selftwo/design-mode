# 02: Sweep every component CSS file onto the DLS

Status: open
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

- [ ] No component CSS file has a literal color, font size, or spacing value outside the token block (`rg '#[0-9a-fA-F]{3,8}|font-size:\s*\d|\b\d+px' src --glob '*.css'` returns only the token block and justified geometry like border widths).
- [ ] Each listed surface visually matches its catalog row in both themes.
- [ ] Every `data-testid` and ARIA role/name is unchanged; e2e passes without edits.

## Verify

`npm run verify`. Compare each surface against design/showcase.html side by side, both themes.
