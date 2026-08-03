# 11: Developer harness residue in the product chrome

Status: done
Type: task
Severity: P2 (register; needs one user decision)

## Defect

The binding toolbar (`board.html:227-241`) is title + Select/Circle/Comment/Learn + Import + Live: 6 controls. The implementation shows 10: it adds the `reactflow` mono badge, the React Flow/Excalidraw engine switcher, Reset, and the theme toggle. The engine switcher and badge appear in no binding screen; together with the ms readout and `screenshot mode` (ticket 10) they make the product read like its own test rig. Reset next to Import is also a misclick hazard for the destructive action.

## Decision needed (ask the user before building)

Where the engine switcher and engine badge live. Options: (a) behind a `?dev=1`-style flag or keyboard chord, hidden by default; (b) moved into the project picker/onboarding surface; (c) kept in the toolbar deliberately, recorded in `DECISIONS.md` as a deviation. The theme toggle stays user-facing (phase-3 done-when requires it; DECISIONS.md already covers placement). Reset should at minimum move to the far end or behind the board pill's menu when ticket 10 restores the pill.

## Done when

- [x] The default toolbar shows the binding six plus the recorded extras only.
- [x] Engine switching remains reachable for development (all engine e2e flows still pass; `engine-name` and switcher testids preserved wherever they render).
- [x] Reset separated from the constructive cluster.
- [x] The chosen shape recorded in `DECISIONS.md`.

## Verify

`npm run verify`. Toolbar side-by-side with `board.html`, both themes.

## Comments

The engine badge and switcher render only with `?dev=1`; theme remains user-facing and Reset moved to the end of the actions group. The migration is recorded in `DECISIONS.md`.
