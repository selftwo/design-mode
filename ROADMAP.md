# Roadmap

The ambition: a personal design tool that works like a cursor for design. Invokable from any terminal or browser, neutral to whichever coding agent does the work, good enough looking to trust with taste, and a teacher: point at anything on the canvas and ask, and an agent answers in place.

Ordered by dependency, not by date. Each item graduates into a spec (`specs/`) with a decision entry when it starts.

1. **Visual system redesign.** `specs/redesign-visual-system.md`. The DLS at `claude-design/dls/designmode/` becomes the visual source: token-complete re-skin, then fluid layout, one notice system, docked activity, dark theme.
2. **Per-project vocabulary.** Intent chips load from the target project's own context: its DESIGN.md terms plus the shared working vocabulary (`claude-design/flow-design/vocabulary.md`). The context pane also surfaces a taste source file (such as `taste/DISTILLATION.md`) when the target repo carries one. Existing decision trigger: "Reviewers need per-project custom vocabularies."
3. **Blind compare surface.** Two captures or live frames side by side, sides assigned by id hash, pick with ties, one reason per pick, discipline chips. Technical gates run on both sides before a pick is asked. The arena protocol (`claude-design/arena/README.md`) is the reference implementation; results carry staleness like captures do.
4. **Teach mode.** Pick any element and ask. The dispatched agent replies as canvas comments anchored to the element: what it is, how it is structured, which vocabulary applies, how a tool like Figma would decompose it. Same review-batch contract, reversed direction: the agent annotates for the human.
5. **Verdict staleness.** Recorded picks and compare results age the way captures do; an old verdict prompts a fresh blind label instead of being reused.
6. **Image probe review.** Import generated visual-direction probes as frames, compare them with the blind surface, mark the approved lane, and dispatch implementation referencing the pick.
7. **More hands, from anywhere.** Additional agent adapters (Grok, CMUX, Pi, OpenCode) behind the same quarantine; a single CLI entry (`design-mode`) that boots the host and opens the browser from any directory.
8. **Desktop shell.** Wrap the host once the workflows above are stable; the host is already the foundation a shell would wrap.
9. **Motion and sound layer.** The DLS motion tokens applied to canvas transitions; at most one sound, on the signature act, per the taste laws.

Out of scope until an item pulls them in: multi-reviewer pools, remote access, host round-trip board persistence beyond local storage.
