# 05: Islands stack on each other; blooms detach during pan; off-screen threads show nothing

Status: done
Type: task
Severity: medium (three placement defects, one ticket because they share `island-placement.ts`)

## Defects

1. **Islands collide.** `LayersAndAspectsIsland`, `RunsIsland`, and `ReviewCommentsPanel` all feed the identical selection rect into `dodgeIslandPosition`, so with a selection + ≥1 run + ≥1 annotation in local-host mode all three land on the same left/top and occlude one another (visible in visual-proof/after/04: the aspects island is buried under Comments). Only `AnnotationBloom.placeBloom` avoids one other island, by hardcoded testid.
2. **Bloom detaches mid-gesture.** `AnnotationBloom` re-anchors only on `document.camera`, which the React Flow engine writes in `onMoveEnd`. During a pan/zoom the marks move while the viewport-fixed bloom stays frozen, then snaps. Possibly acceptable; decide and either re-anchor per frame (rAF while a gesture is active) or fade the bloom during the gesture (DLS settle on release).
3. **Off-screen thread selection shows nothing.** `onlyRenderVisibleElements` unmounts off-viewport nodes; `readSelectionBounds` finds no `[data-annotation-id]` and the bloom parks at `left:-9999`. `jumpToAnnotation` (`App.tsx:453-456`) never pans the camera. Rail click on an off-screen thread = status says selected, nothing visible.

## Fix

Extend the dodge input from one selection rect to a list of obstacle rects (selection + every open island's current rect), choosing placements that avoid all of them; drop the hardcoded-testid special case in `placeBloom` and pass obstacles uniformly. For 3, make `jumpToAnnotation` pan/zoom the camera to the mark first (React Flow `setViewport`/`fitBounds`), then open the bloom. For 2, record the chosen behavior in `DECISIONS.md`.

## Done when

- [x] With a selection, an annotation, and a run visible, no two open islands overlap (Playwright asserts pairwise non-intersection of bounding boxes).
- [x] Dragged placements still win over dodge for the session (existing contracts untouched).
- [x] Rail click on a thread whose frame is outside the viewport pans to the mark and opens its bloom (new e2e).
- [x] Mid-gesture bloom behavior is deliberate and recorded.

## Verify

`npm run verify`.

## Comments

Implemented obstacle-list dodge, per-frame bloom re-anchoring, and visible off-screen React Flow nodes. The placement and camera behavior are recorded in `DECISIONS.md`.
