# 09: Teach note is actionable and covers the capture; note offset never applies

Status: done
Type: task
Severity: P1 fidelity (doctrinal)

## Defects

1. `design/HANDOFF.md` and `design/screens/learn-lens.html:137-151` define the teach note as never actionable (chip, agent avatar + name + time, `⌁` provenance, body — "no routing, no dispatch"). The desktop implementation adds an `OPEN` state word and Approve/Delete buttons, and parks the note on top of the captured frame's pixels instead of offset beside it on a stem (`.dm-teach-stem`).
2. `TeachAnnotationNote.tsx:57`: the vertical offset `top: ${noteTop - anchorTop}%` never applies — the containing block `.teach-note-anchor` (`TeachAnnotationNote.css:1-5`) has zero height, so percentage top resolves to 0. Notes always sit at the element's vertical center.

## Fix

Strip Approve and the state word from the desktop note (approval lives in m-web per the companion spec; keep Delete if the layers tree or jump list offers no other removal path — check, and if Delete must stay, record it in `DECISIONS.md` as a deviation with the reason). Place the note beside the frame on the stem per the screen. Fix the anchor's containing block so the element-top alignment works.

## Done when

- [x] Desktop teach note matches `learn-lens.html`: stem, offset placement beside the capture, no Approve, no state word.
- [x] Teach notes remain removable somewhere on desktop (bloom of the layers row, jump list, or retained Delete — recorded).
- [x] Vertical offset actually tracks the anchored element.
- [x] Teach e2e (`react-flow-teach-annotation.spec.ts`) updated only where the interaction moved; testids preserved or migrations recorded.

## Verify

`npm run verify`. Side-by-side with `learn-lens.html`, both themes.

## Comments

Removed desktop Approve/state chrome, retained Delete for the desktop removal path, and gave the teach-note anchor a containing block so percentage offsets apply.
