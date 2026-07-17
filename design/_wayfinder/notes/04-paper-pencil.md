# Research note — Paper.design and Pencil.dev

Facts only. Sources: paper.design/compare/figma, paper.design, Paper blog "A real space to design in the age of agents", pencil.dev, banani.co reviews of both.

## Paper.design
- A design tool built on real HTML and CSS; "the canvas needs to be made of the same material as the product." Elements are real DOM nodes with real CSS — "Real HTML/CSS — web-native, no translation step" vs Figma's "Proprietary model (WebGL-based canvas)."
- Styling is actual CSS: "Real CSS styles, outlines, shadows, filters"; layout editing is the real box model — "Add Flex", the engine "understands flexbox, padding, gap, and all the properties that actually matter on the web."
- Color is CSS-native: mixes `oklch()`, display-p3, and hex per element; OkLCH/Oklab perceptually uniform picker (vs Figma's HSB file-wide toggle).
- Panels: layers left, inspector + design tokens right; any node's JSX/Tailwind output is retrievable. Export is real HTML/CSS, no conversion.
- Agents: a bidirectional MCP server (~24 tools) lets any agent read and write the canvas (frames, styles, text, screenshots, per-node code). Philosophy: "You can't scale design decisions in a chat box" — humans supply spatial reasoning and intent, agents do the repetitive work; pull reality onto the canvas, push decisions back into code.
- No explain/teach affordance found — real CSS is inspectable, but nothing tutorial.

## Pencil.dev
- "Design on canvas. Land in code." An agent-driven canvas over an open design format living in the codebase; sits inside VS Code/Cursor; files version with git.
- Code-backed: placing a button places a real component; adjusting spacing adjusts real values that map to CSS properties. A reviewer characterizes Pencil as an overlay that "doesn't actually generate anything" — generation is delegated to Claude Code (third-party claim).
- Panels: a layers panel + a panel of editable CSS properties + direct manipulation; supports on-canvas sticky notes as context (distinct from Figma comments).
- Runs up to six agents concurrently on one canvas, each generating its own direction from a brief; output is clean HTML/CSS/React/Tailwind.
- No explain/teach affordance found.

## What this settles for designmode
- Both tools validate the split Ben already runs: the canvas is for spatial judgment; generation lives with the agents/CLIs, not a chat box on the canvas.
- The web-native register fits this product exactly: design-mode reviews real web products, so aspects can speak the product's own material — `display:flex`, `gap`, `padding`, type size/leading, color as the product declares it — rather than abstract geometry.
- A teach/explain surface (click an element, understand its structure and vocabulary, ask and get an anchored answer) exists in neither tool. It is designmode's own move.
