# Round 2 addendum — applies on top of CONTENT.md

Round 1 verdicts ([round-01-feedback.json](round-01-feedback.json)): A, D, E promising; B rejected. Every round 2 variant keeps the full CONTENT.md board, annotations, interactions, and taste guardrails, plus the requirements below. Research grounding: [../notes/04-paper-pencil.md](../notes/04-paper-pencil.md).

## 1. Annotations are a third material
Three materials on screen: tool chrome, captured screens, and annotations — and they must read apart at a glance ("everything looks the same" is the round 1 failure). Comments/threads get a distinct annotation material: its own surface tone (not raw canvas, not capture white) plus rose annotation accents. However the variant builds it (note, bloom, flip line), an annotation is never confusable with the capture it sits near.

## 2. Summoned panels dodge the selection and carry their own tone
- No permanent docked column. Panels appear when invoked or on selection, and dissolve.
- A summoned panel NEVER covers the current selection: if the selected object sits where the panel would open, the panel opens on the other side, or shrinks, or the canvas shifts the object clear. Demonstrate it: selecting a mark on the right-side frame must visibly relocate/resize the panel.
- The panel surface is its own muted tone — one step distinct from the canvas ground (round 1: "air that gained ink" read as blending; "can have muted different tone").

## 3. Aspects speak CSS (web-native register, from Paper)
The reviewed products are real web pages, so element aspects show the product's own material, not abstract geometry: `display`, `gap`, `padding`, `font-size`/`line-height`, `color` as declared (hex or `oklch()`), measure/width. Mono, key–value lattice. Frame aspects keep route/viewport/revision/hash. Fixture values for the elements are your choice but must be plausible CSS for the drawn mock screens.

## 4. The learn/ask surface (first cut — designmode's own move; neither Paper nor Pencil has it)
- Hidden until invoked: a quiet "Learn" affordance (a tool word or an action on selection). Never ambient.
- Open + click an element → the element's anatomy: a small structure tree (e.g. `card = flex column · gap 12 > title > support`), the vocabulary term doing the work (measure, leading, lattice, signal…), and one plain-language line on why it reads the way it does.
- One Ask exchange, canned: Ben asks "Why does this card read heavier than the others?" → the answer arrives as an ANCHORED explanation from the agent (accent avatar, `⌁` provenance) attached to the element — visually a teach annotation, distinguishable from review comments (no routing/dispatch on it). No chat surface, no generation. Generation stays in the CLIs; changed designs come back via dispatch → agent → localhost refresh (the existing loop).

## 5. Branch discipline
State your lineage and what changed from the parent. Stay opinionated: fix what round 1 rejected in YOUR grammar; do not converge on a sibling's answer.
