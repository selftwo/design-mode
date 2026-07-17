# 15: m-web approve flows and the phase 4 gate

Status: open
Type: task
Phase: 4 (m-web)
Blocked by: 14
Spec: specs/m-web-review-companion.md

Read first: design/screens/m-web/thread.html approve states; the phase 4 done-when in design/HANDOFF.md.

## What to build

The responding half of the companion, then run the phase gate.

- Approving: accept a returned change or a teach annotation from the thread view, without the full island layout. Approval state round-trips through the host and is visible on the desktop canvas (thread state word updates).
- Rejection/dismissal per the thread screen's states.
- Confirm the authoring lockdown holds end to end: no route, deep link, or API call reachable from m-web can author marks, trigger capture, or compose dispatch.

Phase gate:

- [ ] `npm run verify` passes.
- [ ] The m-web surfaces in design/screens/m-web/ all render correctly at mobile-web widths, both themes.
- [ ] Thread reading, reply, and approve work end to end against the same host and review-batch contract as desktop (Playwright at m-web breakpoints).
- [ ] Nothing from the authoring toolset is reachable from this surface (asserted, not assumed).
- [ ] Bundle cap and `ready-ms` hold on the desktop route.
- [ ] Evidence recorded under Comments; the pivot's four phases are done — update `.scratch/designmode-pivot/spec.md` acceptance and record any final deviations in DECISIONS.md.

## Verify

This ticket is the verification for phase 4 and the close of the pivot.
