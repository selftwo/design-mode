# Wayfinder map — designmode DLS

## Outcome
Grow `dls/designmode/` from foundations into a full DLS plus screens for every product scenario. The product reads as a canvas with generous whitespace; comments, tags, and agent comments follow the Eddy/read-review grammar; a Figma-style right-side layers-and-aspects panel shows details when a component is selected. Two to three directions go to Ben; he picks; vertical slices follow, each approved before its brief. Production implementation waits for the approved direction and slice.

## Settled
- Foundations exist: spruce signal + warm stone neutrals + rose marking ink, 4pt spacing, 7-step type, settle motion, both themes AA (`readme.md`, `tokens/tokens.css`).
- Product constraints: `app.css :root` strict-superset token seam, zero new runtime deps, gzip cap, testids/ARIA preserved ([notes/01-scenario-inventory.md](notes/01-scenario-inventory.md)).
- Annotation grammar source: the Paper & Ink review layer — inline anchored threads, state words, accent-filled agent avatars, `⌁` provenance, candidate chips, neutral staleness ([notes/02-annotation-patterns.md](notes/02-annotation-patterns.md)).
- Taste laws govern chrome and density; canvas precedent is Strand's fixed chrome islands + luminosity-based attention and Writespace's island panels + sidecar comments ([notes/03-canvas-and-panel-precedent.md](notes/03-canvas-and-panel-precedent.md)).
- Right side hosts layers and aspects (Ben's direction). Arena runs only when Ben asks.
- Round 1 verdicts ([grill/round-01-feedback.json](grill/round-01-feedback.json)): **A, D, E promising; B rejected** ("does not work"). Panels appear only when invoked (C's summoned quality praised; B's permanent column is the rejection). A summoned panel must never cover the selection — it resizes or moves. Comments must contrast with the field ("everything looks the same" / "blending with background is not helpful"); a summoned panel gets its own muted tone, not raw canvas. A's island separation of runs/elements is liked; E's in-place comments are liked.
- Tone ruling (paper.design captures): Ben loves Paper's color style; the benches' first palette is rejected — pink/rose annotation surfaces most of all. The working tone spec is [grill/TONE.md](grill/TONE.md): cream ground, white floating panel material, ink ramp, ivory annotation paper, rose only as marking accents, spruce stays the one accent. The aspects surface carries Paper-inspector-grade section anatomy (Layout, Flex, Radius, Fill as swatch+named-token rows, Border, Type). Central DLS token retone happens after the direction pick.
- No generation chat on the canvas — generation stays in the CLIs; changes come back via dispatch → agent works → localhost refresh. The canvas gets a hidden **learn/ask panel** instead: invoked deliberately, click an element to understand its components/structure, ask the agent and get answers (teach mode, answers as explanations, not generation).

## Open questions
- **Q1 · Panel architecture.** Narrowed by round 1: permanent docked column rejected; panels are summoned and must dodge the selection. Remaining: A's islands vs D's editor discipline vs E's materialized air (with its own muted tone). → round 2 prototypes.
- **Q2 · Comment placement.** Narrowed: comments read on the canvas (A's bloom, E's flip both liked) but must contrast against field and captures. Remaining: the contrasting annotation material (paper note tone vs ink treatment). → round 2 prototypes.
- **Q3 · Ground and whitespace.** Still open across A (plain air + islands) / D (dot grid instrument) / E (dim field, luminosity raise — but less blending). → round 2 prototypes.
- **Q6 · Learn/ask panel shape.** How the hidden teach surface appears, what it shows for a clicked element (component anatomy, structure, CSS-terms), and how an asked question and its agent answer render. Informed by Paper.design / Pencil.dev research. → round 2 prototypes carry a first cut.
- **Q4 · What "layers" means here.** Candidate tree: board → frames → extracted elements → marks/annotations, with agent runs as a lane. Aspects per selection type (nothing / frame / element / annotation). Data model supports it; scope is a human decision folded into the direction pick.
- **Q5 · Scenario screen set.** Inventory complete (note 01). Direction prototypes carry 2–3 hero screens; the full set arrives as slices.

## Fog
Teach mode and in-product blind compare (roadmap 3–4) — not precise enough yet. Motion/sound layer specifics. Product/DLS name (Redline / Lightdesk / Trace pending).

## Out of scope
Production implementation in `~/Documents/design-mode`; host/API/ReviewBatch contract changes; arena runs; multi-reviewer.

## Frontier
The direction question is resolved through two grill rounds ([grill/round-01-feedback.json](grill/round-01-feedback.json), [grill/round-02-feedback.json](grill/round-02-feedback.json)): **Islands is the direction** — floating physical furniture over an edge-to-edge canvas, threads blooming at the mark, summoned layers+aspects island with dodge-by-default. Rejected: docked column (B), sidecar-as-direction (C), one-color quiet field (E1 — "a mess"), height-constricted pro panel (D1; also: busy top bars). Kept lessons: summoned-only panels that never cover the selection; the learn lens must float, drag, and close; user placement beats auto-dodge once exercised.

Round 3 resolved ([grill/TONE-3.md](grill/TONE-3.md)): **A2 Violet ink is the DLS voice.** A3 Electric archived (its dark ground informs the dark theme, not the default). Cool blue-gray ground, white islands, one violet signal, hue-per-job materials (violet signal / coral annotations / teal teach / green runs), AA everywhere in chrome.

Built per Ben's order (2026-07-17): `tokens/` + `components/` + `showcase.html` in the Violet ink voice, light default + `[data-theme="dark"]` (dark chrome so light-colored captures pop; AA ratios annotated per pair in both themes); `screens/` — 8 desktop scenario spec screens + gallery (board · review-dispatch · returned-run · aspects · learn-lens · live-view · compare · states); `screens/m-web/` — 5 decluttered mobile review-companion screens + gallery (boards · capture · thread · runs · notices; read/reply/approve only, no authoring); [`HANDOFF.md`](../HANDOFF.md) — the dev-takeover document (binding direction, feature list, 4-phase roadmap + later phases, hard constraints, provenance). All targets pass `arena/gates.mjs` with zero fail lines in both themes. Production implementation in `~/Documents/design-mode` stays out of scope; HANDOFF.md is the boundary object.

Remaining human decisions: the product/DLS name (Redline / Lightdesk / Trace), and whether Phase 1 re-skin starts now.
