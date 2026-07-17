# Research note — Eddy / Read-Review annotation patterns, and what designmode lacks

Sources: `dls/eddy/`, `dls/hl/`, `dls/vellum/` review layers; `dls/designmode/`. Facts only.

## Token layer ("Paper & Ink" review model)
`dls/eddy/tokens/review.css` ≡ `dls/hl/tokens/review.css`; Vellum trimmed. Rule: paper + ink + one signal carry the screen; amber/red only as single-glyph traces.
- Reading: `--reader-serif` Charter stack, `--reader-size 1.0625rem`, `--reader-leading 1.75`, `--measure 42rem`, `--reader-rail 320px`.
- Anchors: `--anchor-wash` (10% accent), `--anchor-rule` (2px accent), `--anchor-element` (4% wash), `--anchor-stale` (neutral border-strong, never alarmist).
- Routing: pending=muted, sent/returned=accent, unreachable=warning (the one amber).
- Provenance: muted ink on sunken surface. Diff: desaturated `--diff-add #0f6e56` / `--diff-del #a32d2d` (dark `#5de4c7`/`#d0679d`).
- Review states (Vellum): `--review-open` accent · `--review-resolved` · `--review-attention`.

## Comments
Placement: **in the flow of the work**, never rail-only; the right rail is jump links only.
- Anchor = `<mark>` on the quoted passage: wash bg + 2px accent underline; `<sup>` count badge in accent mono. Resolved → transparent + 1px neutral underline. Stale → neutral rule.
- Thread expands inline under the paragraph: `border-left 2px` state-ink, sunken bg, 240ms translateY open. Header = 6px state dot + uppercase state word + scope chip. Comment = author line (2xs uppercase muted) + body (read font, sm).
- HL statuses: open ● / awaiting_lens ◷ (dashed) / lens_replied ● (accent + action fill) / resolved ✓ (neutral).

## Tags / chips
- AnchorScopeChip: 3xs uppercase semibold, 3×7px pad, 1px border; stale = dashed border + " · stale". Kind glyphs: `“` text, `▢` element, `¶` heading, `•` list, `▦` table, `⌗` code, `◇` node, `→` edge.
- HL Chip: flat mono 3xs uppercase; status variant = leading 6px dot (the only pill radius in the system).
- Designmode `.dm-chip`: no border, 6px radius, xs medium; pressed = accent fill. `.dm-badge`: never boxed — a colored mono word.

## Agent vs human authorship
- Avatar: human = inverse ink; **agent = accent-filled** (`--accent` bg + `--accent-contrast`), 18px, mono initials.
- `⌁` glyph = machine marker (provenance chips, agent mode in ledgers; manual `✎`, lens `◑`).
- "Candidate" chip on agent-proposed content: accent border, uppercase.
- Provenance chip: mono 3xs uppercase, `⌁ run {id} · {session} · {time}`.

## Revisit / send-back
- RoutingControl: tag a lens (@skeptic @pm @qa @security) + "Hand to agent →"; timing Now / Any point / Batch at end; states as dot+word (not routed/pending/sent/returned/unreachable).
- ReturnedChange: "↩ Returned from agent" pill, `v1.1 → v2 (candidate)`, provenance chip, diff lines, footer "You own this write — it is ink until you approve", Reject / Edit patch / Approve → v2 (⌘⏎). No agent auto-write.
- ReadSignal: Draft↔Proposed toggle, 120×5px read meter, "I have reviewed ✓" → "● Reviewed". Not a scorecard.
- Eddy send-back: bundle doc + settled comments → one send; ledger flips settled → sent.

## Layout: reading column + apparatus
- Grid `1fr 320px` (fluid read region + fixed rail). Paper 672px, serif 17/1.75. Emphasis = recolor to accent, not bold.
- No margin gutter for comments: text anchors inline-underlined; element anchors overlay any region (1px accent inset + wash + floating corner tag); threads expand inline. Rail = Summary/Activity/Gaps jump list (6px dot + title + meta → scrolls to and opens the inline thread).

## Designmode DLS today (17 components; `dls/designmode/`)
Toolbar, Button, Tab, Input, List row, Intent chip, Badge-as-word, Status dot, Agent activity row, Side panel, Comment, Mark reference, Notice, Captured frame, Dialog, Status bar, Mono text. Tokens: stone ramp (13), spruce micro-ramp (#186358/#4fb3a1), rose marking ink (#d13657), state hues, full semantic aliases both themes, type scale 11–22, 4pt spacing, chrome measures (toolbar 52 / statusbar 28 / panel 320 / comment measure 576), radii 6/10, settle motion set.

**Lacks:** threaded/stateful comments (flat `.dm-comment`, panel-bound, no anchor, no open/attention/resolved); agent-authorship marking inside comments (only a separate `.dm-agent-row`); anchor-scope/kind-glyph chips; **any layers panel**; reading-column apparatus (serif, measure, anchor underline).
**Has:** canvas ground (`--canvas` #f4f2ee / #16140f), `.dm-frame` as the physical object (edge + raise shadow + mono label + selected signal ring), rose mark ink, notices, status dots.
