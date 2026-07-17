# Shared content spec — every grill variant carries exactly this

All variants render the same board, annotations, layers, agent activity, and status. Only the design direction differs. Self-contained HTML/CSS/JS; link the DLS via `<link rel="stylesheet" href="/dls/designmode/styles.css">` (served from the claude-design root at http://localhost:4710). Extend tokens per-direction inside the file when the direction demands it.

## Board
Project **smalltools — landing review**, three captured frames on the canvas:
1. **Home · / · 1440×900** — mock content drawn in CSS: top nav (wordmark "smalltools" + 3 links), hero (headline "Small tools for slow thinking", sub line, one button "Browse the shelf"), a 3-card row (Ledger / Stopwatch / Margins, each title + one support line).
2. **Pricing · /pricing · 1440×900** — nav, "Pricing" heading, two plan columns (Free: "$0 · the shelf", Keep: "$4/mo · your margins everywhere"), one button on Keep.
3. **Home · / · 390×844** — mobile: nav collapses to wordmark + menu glyph, stacked hero, cards stack.

Frames are the physical objects on the canvas (border + raise shadow + mono label above: `Home · / · 1440` etc.). Frame 3 carries revision 2 (recaptured).

## Annotations (marks + threads)
- **#1 circle mark** (rose marking ink) on frame 1's hero. Thread state **open**. Ben's comment: author "Ben", time "2m", body "Hero measure runs the full row. Cap it and let the cards carry the width." Intent chip: **distill** (pressed). Agent reply beneath: accent-filled avatar "FB", "Candidate" chip, provenance `⌁ run r-142 · s-9 · 1m`, body "Proposed: measure capped at 60ch, cards move up 32px. Patch staged." Routing state: **returned**.
- **#2 element mark** (element rect) on frame 2's Keep plan card. Thread state **resolved** and **stale** (made against revision 1; anchor renders neutral, chip shows "▢ element · stale"). Ben's comment: "Both plans read the same weight. The paid one should feel like the object." Intent: **bolder**. No agent reply.
- **#3 comment pin** (numbered pin "3") on frame 3's stacked cards. No instruction yet — draft state, "No instruction yet" placeholder, no intent chosen.

## Layers tree (what selection reveals)
Board → three frames → each frame's extracted elements (frame 1: nav, hero, card-row; frame 2: nav, heading, plan-free, plan-keep; frame 3: nav, hero, card-stack) → marks nest under their element/frame (#1 under hero, #2 under plan-keep, #3 under card-stack). Kind glyphs per note 02 (`▢` element, `“` text where fitting, pin numbers for comments).

## Aspects (right-panel details per selection)
- **Nothing selected:** board aspects — project name, 3 screens, capture source `localhost:5173`, last capture "4m ago", theme.
- **Frame selected:** route, viewport, revision, capture hash (mono, truncated `c41f…9a`), staleness line, element count.
- **Element selected:** label, role, normalized bounds (x/y/w/h as %), parent frame, "1 annotation".
- **Annotation selected:** the full thread (comment anatomy above) + intent chips row + routing state dot+word + Dispatch action.

## Agent activity
Two runs: `r-142 · fable · done · "measure patch staged"` and `r-143 · codex · running · "recapturing /pricing"`. Presence follows the direction's grammar (rail, row, or island) but content is fixed.

## Chrome content
- Toolbar: title "Design review canvas", tools select/circle/comment (select active), Import, Live toggle (off).
- Status line: `3 screens · 3 annotations · saved · live off`.
- Context source (if the direction shows it): DESIGN.md tab active, two mock lines.

## Required working interactions (all variants)
1. Click frame / element / mark → selection ring + the aspects surface updates for that selection type; click empty canvas → board aspects.
2. Annotation #1 opens its thread (per the direction's placement answer) showing the agent comment.
3. Layers tree rows select-sync with the canvas (click row → canvas selects; canvas select → row highlights).
4. Keyboard: Tab reaches tools, tree rows, marks; visible focus ring (`--focus-ring`); Escape clears selection.
5. Honest at 1440 and 390 (390 may collapse panels per the direction's own logic — no overflow, no broken chrome).

## Taste guardrails (from notes/03)
One grid held per surface; one accent (spruce) + rose reserved for marks; borders only on physical objects (frames, and paper notes if the direction makes comments physical); no repeated chrome; one settle (220ms, the DLS easing) on the direction's signature move; nothing loops; reduced-motion honored.
