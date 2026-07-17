# 14: m-web companion — boards, threads, reply

Status: open
Type: task
Phase: 4 (m-web)
Blocked by: 13
Spec: specs/m-web-review-companion.md

Read first: all of design/screens/m-web/ (boards.html, thread.html, capture.html, runs.html, notices.html, index.html); the m-web section of design/HANDOFF.md.

## What to build

The reading half of the mobile-web review companion, served by the existing host as a separate route from the desktop canvas.

- Boards list per boards.html: the reviewer's boards with review state at a glance.
- Thread view per thread.html: open a bloomed thread's history (human comments, intent chips, agent candidate replies with the `⌁` glyph, teach notes), read it, and add a reply that lands in the same thread the desktop sees.
- Capture and runs views per capture.html and runs.html: read-only visibility into captures and run history.
- Notices per notices.html.
- Same host API and review-batch contract as desktop — no forked m-web endpoints; replies go through the same validated boundary.
- The m-web route must not load the React Flow canvas engine; keep it out of the desktop bundle measurement and give it no canvas dependency.

No mark authoring, no capture triggering, no dispatch composition, no layers-and-aspects island on this surface.

## Done when

- [ ] The four read surfaces render correctly at the viewport widths in design/screens/m-web/, both themes.
- [ ] A reply added on m-web appears in the same thread on desktop.
- [ ] The m-web route ships without the canvas engine; `npm run measure` is unaffected.
- [ ] Nothing from the authoring toolset is reachable.

## Verify

`npm run verify` plus a Playwright pass at the m-web breakpoints for boards → thread → reply.
