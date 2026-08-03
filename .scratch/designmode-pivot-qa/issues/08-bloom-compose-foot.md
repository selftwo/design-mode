# 08: Dispatch moved out of the bloom — restore the compose foot per review-dispatch.html

Status: done
Type: task
Severity: P1 fidelity (the binding screen wins)

## Defect

`design/screens/review-dispatch.html:187-192` puts the compose foot — agent `<select class="dm-select">` + primary `Send` button — inside the bloom, with foot text "not routed · dispatch sends 1 annotation". The implementation's bloom has no author head, no agent select, no Send; its foot literally reads "not routed · dispatch sends from the comments rail", and dispatch lives only in the Comments island footer. Pivot ticket 09 recorded this as matching the screen; it does not. The reviewer's core loop (mark → intent → dispatch) currently spans two islands and a full screen-width eye movement.

## Fix

Restore the compose foot inside `AnnotationBloom`: agent select (same options/availability source as the rail's `dispatch-agent`) and a Send that dispatches that one annotation (single-annotation batch through the existing `buildReviewBatch` path; delivery states idle/delivering/delivered/blocked per the screen's spec rows at lines 271-272+). Keep the rail's "Copy all / Send to host" as the batch path only. Add the author head (avatar + name + time) per the screen if reviewer identity exists; otherwise record that omission in `DECISIONS.md`.

If the user prefers the rail-only dispatch after seeing this, do not implement — instead rewrite the DECISIONS.md entry to record the deviation honestly. Default is implement.

## Done when

- [x] A complete annotation can be dispatched from its bloom without touching the Comments island (new e2e).
- [x] Single-annotation batch reaches the host with the same schema; batch send from the rail unchanged.
- [x] Delivery states render in the bloom foot per the screen.
- [x] Existing dispatch e2e contracts preserved.

## Verify

`npm run verify`. Side-by-side with `review-dispatch.html`, both themes.

## Comments

Restored the bloom compose foot with agent selection and single-annotation Send using the existing review-batch delivery lifecycle. The rail remains batch-only.
