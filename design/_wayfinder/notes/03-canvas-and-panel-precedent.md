# Research note — canvas whitespace precedent + Figma-style panel anatomy

Facts only.

## Workspace canvas precedent

### Strand (`dls/strand/`, strongest precedent)
- Fixed full-viewport `#viewport` holding a 4000×3000 `.stage` translated/scaled in JS; dot grid lives on the stage (pans/zooms with content). All chrome is fixed, corner/edge-anchored islands that never scale: top-left scene toggle, top-center create toolbar, bottom zoombar with presets, right-docked intake tray (Board scene only).
- Whitespace: canvas ground one value step below paper; empty field is dimmed "air"; **attention raises luminosity rather than adding fill**; position itself is meaning.
- Selection: single-select border signal; selecting lights its connections in signal color and dims the rest of the field. "Register flip": card ⇄ one mono summary line, driven by rendered width (~240px), ~240ms. Only canvas shadow = mid-drag lift. Detail resolves **in place**, no inspector.

### doc-canvas / Writespace (`explorations/doc-canvas/`)
- Excalidraw language verbatim: white surface, faint dot grid, floating island panels with soft layered shadows. "Board is the map, bench is the room": docs are cards; opening one goes to a separate reading bench. Comments in a **sidecar, never floating over the work at rest**.
- Research rule set (08-familiar-canvas-ux.md): three registers (overview / working canvas / one item); zoom changes information per register; rare controls stay one deliberate step away in sidecar/inspector/popover; **AI has no ambient panel — appears only when invited at the item level**; selection exposes actions, never changes voice; placed material never moves or fades automatically.

### mind-thoughts (`mind-thoughts/`)
- Full-bleed immersive canvas; chrome = corner HUD labels, pointer-events none; proximity/focus surfaces one thing; whitespace is the medium (dark void). No docked panels — the opposite pole from a workspace tool.

### references/ library
- `wordfield.html` ★ (cursor-lens field, "the air every screen sits in"), `sliding-panes.html` ⚒ (open-beside, trail as collapsed spines), `commonplace.html` ~. No entry frames a docked inspector.

## Taste laws bearing on this surface (verbatim)
- Spine: "Layout and density decide most picks… The kill word is 'cluttered'. Space is spent efficiently, not generously; the failure mode is not too much content but too many elements carrying it."
- One grid, held: "The layout's grid does not change mid-page."
- Surface conditional: "Scanning and utility surfaces… get a dense lattice: rows separated by alignment and whitespace, not rules or boxes."
- No boxes: "Borders live only where a thing reads as a physical object… Alignment does the work a border pretends to do."
- No repeated chrome: "A menu bar, header, or control that appears twice on one surface disqualifies it."
- Color: "one accent, warmth as a trace… Color annotates and responds to touch; it never decorates."
- Motion: "One settle per surface, decelerating in, brief out, bound to the hand, never looping."
- Scope: cards may stand where they do structural work.

## Figma-style panel anatomy (factual)
- Shared shell: left panel (layers/pages/assets) · infinite canvas · right inspector. **Figma and Sketch put the layers tree LEFT; the right panel is properties only.** Framer is the consolidated alternative: **layers tree + inspector share the right column** (left reserved for pages/assets/insert).
- Layers tree: indented hierarchy, top row = top z-order; type icons; rename; per-row eye (visibility) + lock; component instances tinted. Selection sync both ways; hover in tree outlines the object on canvas and vice versa (one shared selection model); drag rows to reorder/reparent; deep-select enters containers.
- Inspector: contextual to selection, stacked collapsible sections in stable order — alignment row · position/size/constraints · auto-layout (frames only: direction, gap, padding, alignment picker, hug/fill) · fill(s) · stroke · effects · layer opacity/blend · export. Text selection adds typography (family, weight, size, line height, letter spacing, alignment, resizing). Every value section exposes a connect-to-style/variable affordance.
- Empty selection → document/page/canvas properties. Multi-selection → intersection of applicable sections; agreeing fields show the value, differing show **"Mixed"**; editing writes to all. Sections hide (not gray) when inapplicable; order stays stable. Collapsed state persists in-session; empty sections show header + "+".
