# Round 3 spec — Islands direction locked, cool palette, movable furniture

Round 2 verdicts ([round-02-feedback.json](round-02-feedback.json)): **Islands (A1) is the chosen direction.** E1 archived ("all of this being in the same color is just confusing… archive this"); D1 out (panel height too constricting unless it owns the full right edge; top bar too busy); AE1 not picked. The warm cream "farm" palette is rejected a second time. Round 3 = two rival branches from A1, differing on palette voice; both carry the interaction upgrades below.

## Palette pivot (mandatory, replaces TONE.md's cream/ivory palette)

Ben verbatim: "make it a bit more fun, cool color-wise, something violet-ish, blue-grayish… a bit more flashy. I hate these color palettes." And from round 1, still standing: "there should be diversity or a difference in colors" — the materials must be told apart BY HUE, not only by tone.

Common rules for both branches:
- Cool neutral family: blue-gray ground, white/cool panels, cool near-black ink. Zero warm cream anywhere in tool chrome.
- One violet-family signal as the working accent (selection, pressed chips, focus, active words).
- Materials get DIFFERENT HUES, not tints of one: tool panels (cool white), review annotations (their own hue — warm coral/rose family so review ink pops against the cool field), teach/learn (a second distinguishable hue, e.g. cyan-teal family), runs/presence (green stays for run states). Marks stay in the annotation hue.
- Diversity with discipline: every hue has exactly one job; nothing decorative. But the overall feel is allowed to be flashier than the DLS's old restraint — Ben is overruling quiet here.
- AA everywhere in tool chrome (meta text included — learn from `#726c5c`: verify small-text pairs against every ground they sit on).
- Mock captured screens keep their own fixture palette (they are the reviewed product).

Branch voices (each agent owns exact values, states them in :root with comments):
- **A2 "Violet ink" — cool and composed.** Blue-gray ground (#eef0f4 family), white islands with cool borders and soft shadows, ink #16181d family, one violet signal (#5b57d9 family, Excalidraw/Paper lineage), coral annotation paper, teal teach material. Fun through hue clarity, not noise.
- **A3 "Electric" — the flashy pole.** Push further: deeper blue-gray or dual-value ground, punchier violet + a cyan/electric second trace, annotation and teach materials saturated enough to pop, selected states that feel energetic (washes, lit edges), maybe dark-ink islands for contrast blocks. Still readable, still AA, still one job per hue — but unmistakably flashier. This branch tests where "fun" tips into too much.

## Interaction upgrades (both branches, from Ben's A1 note)

1. **Floating, draggable learn lens.** The learn box is a floating island the user can grab and move anywhere (pointer drag on its header; keyboard: arrows nudge when focused). It has a close ✕ ("close my lens or remove it from the canvas"). While open, clicking different elements updates its content in place — move it somewhere, keep clicking, read. It never auto-repositions against the user's placement.
2. **Movable furniture generally.** The runs island and the layers+aspects island get drag handles too — the dodge remains the DEFAULT placement behavior, but once the user drags an island, their placement wins and is remembered (in-page; no persistence needed beyond the session).
3. **A centered-selection test case.** Ben: "maybe I should test it by clicking something much more centered." Ensure at least one interesting element sits mid-canvas (move a frame or add a mark position) so the dodge/panel behavior with a centered selection is demonstrable and sane.
4. Everything else from A1 survives: bloom threads, summoned aspects with dodge default, CSS-speaking inspector sections, tree sync, Escape cascade, learn non-actionable (fine per Ben), both viewports, zero console errors.

## Verify
Same Playwright pass as round 2 builds, plus: drag the learn island (assert its position changed and content still updates on element click), close it, drag the aspects island then select elsewhere (assert the user placement is respected, no snap-back), and the detector run (`--no-design-system`), fixing real tool-chrome findings.
