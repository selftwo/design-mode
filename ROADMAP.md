# Roadmap

The ambition: a personal design tool that works like a cursor for design. Invokable from any terminal or browser, neutral to whichever coding agent does the work, good enough looking to trust with taste, and a teacher: point at anything on the canvas and ask, and an agent answers in place.

The design source of truth is the handed-off design language system in `design/` (read `design/HANDOFF.md` first). The current effort is the designmode pivot, ticketed at `.scratch/designmode-pivot/`; its four phases come first, in order. Later items graduate into a spec (`specs/`) with a decision entry when their trigger fires.

## The pivot (in flight)

1. **Re-skin.** `specs/redesign-visual-system.md`, issues 01–04. DLS tokens, component sweep, DLS icons, dark theme toggle.
2. **Restructure.** `specs/redesign-visual-system.md`, issues 05–10. Islands over an edge-to-edge canvas; dodge-by-default, drag wins; bloom threads at their marks.
3. **Differentiators.** `specs/learn-lens-teach-annotations.md`, issues 11–13. The floating learn/ask lens and teach annotations in teal with the `⌁` provenance glyph.
4. **m-web.** `specs/m-web-review-companion.md`, issues 14–15. The mobile-web review companion: read, reply, approve only.

## Later, each gated by its trigger (details in design/HANDOFF.md)

5. **Per-project vocabulary.** Intent chips load from the target project's own DESIGN.md terms plus the shared working vocabulary; the context surface shows a taste-source file such as `taste/DISTILLATION.md` when the target repo carries one. Trigger: reviewers need per-project custom vocabularies.
6. **Blind compare, in product.** Two captures or live frames side by side, sides assigned by id hash, pick with ties, one reason per pick, discipline chips, technical gates before votes. The arena protocol (`claude-design/arena/README.md`) is the reference implementation. Trigger: the arena workflow is needed inside the tool.
7. **Verdict staleness.** Recorded picks age the way captures do; an old verdict prompts a fresh blind label. Trigger: ships alongside or after blind compare.
8. **Image probe review.** Import generated visual-direction probes as frames, compare on the blind surface, mark the approved lane, dispatch referencing the pick. Trigger: after blind compare exists.
9. **More hands, from anywhere.** Additional agent adapters (Grok, CMUX, Pi, OpenCode) behind the same quarantine; a single `design-mode` CLI entry that boots the host and opens the browser from any directory. Trigger: a second agent besides the current default is needed in daily use.
10. **Desktop shell.** Wraps the host once the workflows above are stable. Trigger: the host itself is stable enough to wrap.
11. **Motion and sound layer.** DLS motion tokens applied to canvas transitions; at most one sound, on the signature act, per the taste laws. Trigger: after phases 1 to 4 are stable.

Out of scope until an item pulls them in: multi-reviewer pools, remote access, host round-trip board persistence beyond local storage, generation chat on the canvas.
