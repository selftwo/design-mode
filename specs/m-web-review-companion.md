---
title: Mobile-web review companion
status: approved
---

## Problem Statement

A review in progress can only be read at the desk. Replies and approvals wait until the reviewer is back at the full canvas, even though neither needs a canvas at all.

## Solution

A simplified mobile-web surface for reading and responding to a review already in progress, per the five screens in `design/screens/m-web/` (boards, thread, capture, runs, notices). It is a review companion, not a second copy of the desktop tool.

In scope:

- Reading and replying to threads: open a bloomed thread, read its history, add a reply.
- Approving: accept a returned change or a teach annotation without the full island layout.
- Board and run visibility per the m-web screens.

Not included, and not reachable from this surface: mark authoring, frame capture, dispatch composition, the layers-and-aspects island.

## Constraints

- Same host and review-batch contract as desktop; no m-web-only API surface that forks the contract.
- Every hard constraint in `design/HANDOFF.md` holds: zero new runtime dependencies, bundle cap on the React Flow route, testid/ARIA preservation, AA in both themes.
- The m-web surface must not pull the desktop canvas engine into its own load.

## Acceptance

- [ ] The m-web surfaces render correctly at the mobile-web viewport widths represented in `design/screens/m-web/`.
- [ ] Thread reading, reply, and approve flows work end to end against the same host and review-batch contract as desktop.
- [ ] Nothing from the authoring toolset is reachable from this surface.
- [ ] `npm run verify` passes, plus a Playwright or manual pass at the m-web breakpoints.
