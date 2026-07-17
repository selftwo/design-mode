# Designmode DLS

Designmode is a local design review canvas. Captured screens from other products sit on a cool blue-gray drafting ground; the reviewer marks them, attaches intents, dispatches the marks to coding agents, and watches the runs come back. The design language follows from that job: the chrome floats as white islands over the field and recedes, because the canvas hosts other products' colors all day. The register is a product tool on the web platform.

## The hue-job doctrine

Every hue in the tool has exactly one job; materials read apart by hue, never by tints of one neutral.

- **Violet** (`--accent` #5b57d9, Excalidraw/Paper lineage) is the working signal: active tool, selection, pressed chips, focus rings, dispatch.
- **Coral** (`--mark`, `--anno-surface`) is the annotation material: marks, bloom threads, review ink and its paper. Kept apart from `--danger`, so a mark never reads as an error.
- **Teal** (`--teach-ink`, `--teach-surface`) is the teach material: the learn lens and anchored teach notes. The agent's second voice — it explains, it never routes work.
- **Green** (`--run`) is run state: dots and run words only. Violet never marks a run.

Captured screens keep their own palette in both themes; the tool never colors them. Two type registers only: the system UI sans and the system mono for ids, run names, and frame labels. One settle: the decelerating 220ms entrance on islands, blooms, and dialogs.

## Themes

Light is the authored base: blue-gray ground `#eaedf4`, white island material, cool near-black ink. Dark (`[data-theme="dark"]`) is the same voice on a deep blue-slate field `#232838` with dark-ink islands `#141927`, lighter cool edges as caught light, the ink ramp flipped to cool near-whites, and the four hue jobs re-tuned for the dark ground — the dark chrome exists so light-colored captured designs pop against it. Every text token holds WCAG AA (>= 4.5:1) against every ground it sits on in both themes, small meta text included; ratios are annotated in `tokens/tokens.css`.

## Files

- `styles.css` single entry point
- `tokens/tokens.css` all foundations, Articulate-labeled, AA ratios annotated
- `components/components.css` + `components/catalog.md` the product inventory as alias-consuming classes, each assigned to one hue job
- `showcase.html` both themes (toggle persisted, `?theme=` honored), every component, realistic content

## Token contract

The token set is a strict superset of the variable seam in the product's `src/app/app.css`. Every seam name resolves here with the same meaning: `--ink`, `--ink-secondary`, `--ink-muted`, `--ink-faint`, `--surface`, `--canvas`, `--border`, `--border-control`, `--accent`, `--accent-strong`, `--accent-ring`, `--mark`, `--mark-fill`, `--danger*`, `--warn*`, `--ok*`, `--info*`, `--radius-control`, `--radius-panel`, `--shadow-panel`. The product adopts the system by swapping its `:root` values for these; no renames. Added on top: `--accent-text`, the coral annotation material (`--mark-text`, `--mark-pin`, `--anno-*`), the teal teach material (`--teach-*`), `--run`, `--hairline`, well tokens, surface and border sub-roles, the spacing scale, the type scale, motion tokens, and the dark theme.

## Fidelity caveats

- Both type registers are system stacks by design; no licensed faces to substitute.
- Colors, spacing, and motion are authored here, not reconstructed from a live product; the seam names are the only inherited constraint.
- Foundations and the component inventory are covered. Full assembled surfaces (board shell, projects index, run monitor) are pending.
- No claude.ai/design project yet.
