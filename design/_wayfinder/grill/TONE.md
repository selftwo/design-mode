# Paper tone + panel detail spec — applies to the round 2 benches (a1, d1, e1, ae1)

Ben's ruling with the paper.design screenshots: he loves Paper's color style; the benches' current colors are rejected (the rose/pink annotation paper most of all). Rework each bench's LOCAL palette to this spec. Do NOT edit `dls/designmode/tokens/tokens.css` — the central DLS retone happens after the direction pick; benches override locally.

## Palette (from the paper.design captures)

- Ground (canvas air): warm cream `#f2efe4` — greener and warmer than the old stone; the field Paper draws its canvas on.
- Capture/page surface: `#f8f4eb` for the frame body ground where the mock page needs paper; pure `#ffffff` stays legal inside mock screens.
- Panel material (all summoned panels, islands, dropdown-like surfaces): white `#ffffff`, 1px border `#e3dfd2`, radius `--radius-panel`, one soft layered shadow. Panels read like Paper's floating dropdowns: white cards over cream, never tinted pink, never raw canvas.
- Ink: `#16150f` primary, `#5f5c52` secondary, `#726c5c` muted/meta (the raw Paper grey `#8c887b` fails AA on cream/ivory — use it only for non-text traces).
- Hairlines/dividers inside panels: `#eceadf`.
- Accent stays the DLS spruce `#186358`: selected rows get a spruce-wash fill with spruce ink (the way Paper fills its selected row blue), focus rings and signal stay spruce. Do not introduce a blue accent.
- Marking ink: rose `#d13657` survives ONLY as the drawn mark strokes, pins/ordinals, and small annotation state accents. The pink annotation SURFACE is dead: annotation material becomes warm ivory `#fbf8ef` with a `#d9d2bd` edge and ink text — contrast against cream ground and white panels comes from the tone shift + edge + rose accents, not from pink fill.
- Teach material: same ivory geometry with a spruce edge/accent instead of rose. No green fill.
- Amber/orange from Paper's demo content is Paper's content, not our chrome. Do not adopt it.

## Panel anatomy (Paper's inspector grade — "go for details")

The aspects surface, in each bench's own grammar, renders Paper-style sections in stable order. Static fixtures, but fully drawn:

1. **Layout** — X · Y · W · H as four mono value cells (bordered input-look wells, label left/value right), plus rotation 0°.
2. **Flex** (elements that are flex in the fixture) — direction glyph row (→ ↓), `gap`, `padding` value wells; alignment as a compact 3×3 dot picker with the active dot in spruce.
3. **Radius** — one value well (slider optional).
4. **Fill** — swatch + NAMED token row, like Paper's list: a small rounded swatch, then the semantic name in mono (`bg`, `bg-raised`, `text`, `text-muted`, `border`, `accent`), then the raw value right-aligned muted. Show 2–4 rows for the selected element.
5. **Border** — width well + swatch+name row.
6. **Type** (text elements) — size/leading as `18 / 28`, family, weight.
7. Keep the bench's existing Capture · Annotations · Dispatch · Runs sections below, restyled to the panel material.

Section headers: 11px caps-free medium ink, generous 4pt-scale padding, hairline between sections only (no boxed sections). Value wells: `#faf8f1` fill, `#e3dfd2` 1px edge, `--radius-control`, mono 12px.

## Rules

- Every color literal in the bench's tool chrome moves to this spec (mock captured screens keep their own fixture palette).
- All round-2 behaviors survive untouched: summoned + dodge, third-material annotations (now ivory), CSS-speaking values, learn/ask flow, all CONTENT.md interactions, both viewports, zero console errors.
- Verify with the same Playwright pass as the build, plus `node .agents/skills/impeccable/scripts/detect.mjs --json --no-design-system <file>` — fix real findings in tool chrome; classify fixture findings.
