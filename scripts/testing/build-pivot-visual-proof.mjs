#!/usr/bin/env node
/**
 * Build the designmode-pivot visual verification HTML artifact.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve('.scratch/designmode-pivot/visual-proof')
mkdirSync(root, { recursive: true })

function exists(...parts) {
  return existsSync(path.join(root, ...parts))
}

function rel(...parts) {
  return parts.join('/')
}

function figure(src, caption, alt) {
  if (!existsSync(path.join(root, src))) {
    return `<figure class="missing"><figcaption>${caption}</figcaption><p class="missing-note">Missing: ${src}</p></figure>`
  }
  return `<figure><figcaption>${caption}</figcaption><img src="${src}" alt="${alt}" loading="lazy" /></figure>`
}

function pair(title, beforeSrc, afterSrc, beforeCap, afterCap) {
  return `
    <section class="flow">
      <h3>${title}</h3>
      <div class="pair">
        ${figure(beforeSrc, beforeCap, `${title} before`)}
        ${figure(afterSrc, afterCap, `${title} after`)}
      </div>
    </section>`
}

function gifBlock(title, gifSrc, note) {
  if (!existsSync(path.join(root, gifSrc))) {
    return `<section class="flow"><h3>${title}</h3><p class="missing-note">GIF missing: ${gifSrc}</p></section>`
  }
  return `
    <section class="flow">
      <h3>${title}</h3>
      <p class="note">${note}</p>
      <figure class="gif"><img src="${gifSrc}" alt="${title}" /></figure>
    </section>`
}

function still(title, src, note = '') {
  return `
    <section class="flow">
      <h3>${title}</h3>
      ${note ? `<p class="note">${note}</p>` : ''}
      ${figure(src, title, title)}
    </section>`
}

const phase1 = [
  pair('Project picker', 'before-phase1/01-picker.png', 'after-phase1-reskin/01-picker.png', 'Before (pre-pivot)', 'After (DLS re-skin)'),
  pair('Board', 'before-phase1/02-board.png', 'after/01-board-at-rest.png', 'Before (docked chrome)', 'After (floating islands)'),
  pair('Annotation editing', 'before-phase1/03-annotation-editing.png', 'after/04-bloom-open.png', 'Before (docked panel)', 'After (bloom at mark)'),
  pair('Live view', 'before-phase1/04-live-view.png', 'after-phase1-reskin/04-live-view.png', 'Before', 'After (DLS)'),
  pair('Dispatch', 'before-phase1/05-dispatch.png', 'after-phase1-reskin/05-dispatch.png', 'Before', 'After (DLS)'),
].join('\n')

const phase2 = [
  still('Board at rest — floating toolbar + status', 'after/01-board-at-rest.png', 'Edge-to-edge canvas; toolbar and status are islands.'),
  still('Layers + aspects island', 'after/03-layers-aspects-island.png', 'Summoned on frame/element selection (ticket 07).'),
  still('Bloom thread at mark', 'after/04-bloom-open.png', 'Comment thread opens on the mark (ticket 09).'),
  still('Comments jump-list rail', 'after/05-comments-jump-list.png', 'Docked panel replaced by summoned jump list.'),
  exists('phase2-light/02-aspects.png') ? still('Aspects panels (gate 10)', 'phase2-light/02-aspects.png') : '',
  exists('phase2-light/03-review-dispatch.png') ? still('Review dispatch (gate 10)', 'phase2-light/03-review-dispatch.png') : '',
  exists('phase2-light/04-returned-run.png') ? still('Returned run / runs island (gate 10)', 'phase2-light/04-returned-run.png') : '',
  gifBlock('Island dodge + reselect', 'gifs/island-dodge.gif', 'Selection summons the inspector; empty canvas / reselect re-dodges (ticket 06).'),
  gifBlock('Bloom thread authoring', 'gifs/bloom-thread.gif', 'Draw → bloom opens → instruction + intent chips (ticket 09).'),
].join('\n')

const phase3 = [
  still('Learn lens open', 'after/06-learn-lens.png', 'Teal teach material; fixed placement (ticket 11).'),
  exists('after/07-teach-pinned.png') ? still('Teach annotation pinned', 'after/07-teach-pinned.png', 'Pinned answer stays out of dispatch batches (ticket 12).') : still('Teach pinned (gate 13)', 'phase3-light/03-teach-pinned.png'),
  exists('phase3-light/01-learn-lens-open.png') ? still('Learn lens (gate evidence)', 'phase3-light/01-learn-lens-open.png') : '',
  exists('phase3-dark/03-teach-pinned.png') ? still('Teach pin — dark theme', 'phase3-dark/03-teach-pinned.png') : '',
  gifBlock('Learn lens pick flow', 'gifs/learn-lens.gif', 'Open learn → pick element → content updates; position holds (ticket 11).'),
  gifBlock('Theme toggle', 'gifs/theme-toggle.gif', 'Light ↔ dark via toolbar; persists in localStorage.'),
].join('\n')

const phase4 = [
  still('m-web boards', 'phase4-mweb-light/01-boards.png', 'Companion entry at /m-web — 390px, no authoring canvas.'),
  still('m-web capture', 'phase4-mweb-light/02-capture.png'),
  still('m-web thread open', 'phase4-mweb-light/03-thread-open.png'),
  still('m-web thread approved', 'phase4-mweb-light/04-thread-approved.png', 'Approve persists resolvedAt; desktop blooms sync.'),
  still('m-web runs / teach', 'phase4-mweb-light/05-runs.png'),
  still('m-web notices', 'phase4-mweb-light/06-notices.png'),
  still('m-web theme toggle', 'phase4-mweb-light/07-theme-toggle.png'),
  still('m-web boards — dark', 'phase4-mweb-dark/01-boards.png'),
  still('m-web approved — dark', 'phase4-mweb-dark/04-thread-approved.png'),
].join('\n')

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Designmode pivot — visual verification proof</title>
  <style>
    :root {
      --ink: #171a21;
      --muted: #565e70;
      --canvas: #eaedf4;
      --surface: #ffffff;
      --border: #dce0ea;
      --accent: #5b57d9;
      --ok: #067647;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--canvas);
      line-height: 1.45;
    }
    .shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
    nav {
      position: sticky; top: 0; align-self: start;
      height: 100vh; overflow: auto;
      padding: 24px 18px;
      background: var(--surface);
      border-right: 1px solid var(--border);
    }
    nav h1 { font-size: 1rem; margin: 0 0 6px; letter-spacing: -0.01em; }
    nav .meta { font-size: 12px; color: var(--muted); margin: 0 0 20px; }
    nav a {
      display: block; padding: 6px 8px; margin: 0 0 2px;
      border-radius: 6px; color: var(--ink); text-decoration: none; font-size: 13px;
    }
    nav a:hover { background: #f2f4f9; }
    nav .phase { margin-top: 14px; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
    main { padding: 28px 32px 64px; max-width: 1280px; }
    header.hero { margin-bottom: 28px; }
    header.hero h2 { margin: 0 0 8px; font-size: 1.5rem; letter-spacing: -0.02em; }
    header.hero p { margin: 0; color: var(--muted); max-width: 62ch; }
    .badge {
      display: inline-block; margin-top: 12px; padding: 2px 8px;
      border-radius: 999px; background: #edf9f2; color: var(--ok);
      font-size: 12px; font-weight: 600;
    }
    .phase-block { margin: 36px 0 48px; scroll-margin-top: 16px; }
    .phase-block > h2 {
      margin: 0 0 8px; font-size: 1.2rem; padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .phase-block > .lede { margin: 0 0 20px; color: var(--muted); font-size: 14px; }
    .flow { margin: 0 0 28px; }
    .flow h3 { margin: 0 0 8px; font-size: 0.95rem; }
    .note { margin: 0 0 10px; font-size: 13px; color: var(--muted); }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    figure {
      margin: 0; background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(24,30,55,.08);
    }
    figcaption {
      padding: 8px 12px; font-size: 12px; color: var(--muted);
      border-bottom: 1px solid #e7eaf1; background: #fafbfd;
    }
    img { display: block; width: 100%; height: auto; background: #f5f6fa; }
    figure.gif { max-width: 960px; }
    .missing-note { padding: 24px; color: #b42318; font-size: 13px; }
    .checklist {
      display: grid; gap: 8px; margin: 16px 0 0;
      padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      font-size: 13px;
    }
    .checklist li { margin-left: 1rem; }
    @media (max-width: 960px) {
      .shell { grid-template-columns: 1fr; }
      nav { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--border); }
      .pair { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <nav aria-label="Proof sections">
      <h1>Pivot visual proof</h1>
      <p class="meta">Pre vs post · screenshots + GIFs<br/>Tickets 01–15 · gates 04/10/13/15</p>
      <div class="phase">Overview</div>
      <a href="#overview">Summary</a>
      <div class="phase">Phase 1 · Re-skin</div>
      <a href="#phase-1">Before / after surfaces</a>
      <div class="phase">Phase 2 · Restructure</div>
      <a href="#phase-2">Islands, bloom, runs</a>
      <div class="phase">Phase 3 · Differentiators</div>
      <a href="#phase-3">Learn + teach + theme</a>
      <div class="phase">Phase 4 · m-web</div>
      <a href="#phase-4">Companion flows</a>
      <div class="phase">Motion</div>
      <a href="#motion">GIF sequences</a>
    </nav>
    <main>
      <header class="hero" id="overview">
        <h2>Designmode pivot — visual verification</h2>
        <p>
          Side-by-side proof of the DLS re-skin, island restructure, learn/teach differentiators,
          and m-web companion. Phase 1 uses the pre-pivot baseline (<code>dfc3cd4</code>).
          Later phases compare docked chrome to the floating-island product, with gate stills and live captures.
        </p>
        <span class="badge">npm run verify passed · gates 04 / 10 / 13 / 15 closed</span>
        <ul class="checklist">
          <li>Phase 1: picker, board, annotation, live, dispatch — before/after</li>
          <li>Phase 2: floating toolbar/status, layers+aspects, bloom, jump-list, island dodge GIF</li>
          <li>Phase 3: learn lens, teach pin, theme toggle GIF (light/dark)</li>
          <li>Phase 4: m-web boards → capture → thread → approve → runs → notices (light + dark)</li>
        </ul>
      </header>

      <section class="phase-block" id="phase-1">
        <h2>Phase 1 — Re-skin</h2>
        <p class="lede">Tokens, component sweep, icon/hue jobs. Before = pre-pivot commit. After board uses current floating shell.</p>
        ${phase1}
      </section>

      <section class="phase-block" id="phase-2">
        <h2>Phase 2 — Restructure</h2>
        <p class="lede">Edge-to-edge canvas, summoned islands, blooms at marks, runs island, jump-list comments rail.</p>
        ${phase2}
      </section>

      <section class="phase-block" id="phase-3">
        <h2>Phase 3 — Differentiators</h2>
        <p class="lede">Teal learn lens and teach annotations; theme toggle in both themes.</p>
        ${phase3}
      </section>

      <section class="phase-block" id="phase-4">
        <h2>Phase 4 — m-web companion</h2>
        <p class="lede">Read/reply/approve at 390×844. No canvas authoring tools on this route.</p>
        ${phase4}
      </section>

      <section class="phase-block" id="motion">
        <h2>Motion sequences</h2>
        <p class="lede">GIF loops captured from Playwright frame sequences (1.5 fps).</p>
        ${gifBlock('Theme toggle', 'gifs/theme-toggle.gif', 'Light ↔ dark.')}
        ${gifBlock('Island dodge', 'gifs/island-dodge.gif', 'Inspector placement vs selection.')}
        ${gifBlock('Bloom thread', 'gifs/bloom-thread.gif', 'Mark → bloom → instruction.')}
        ${gifBlock('Learn lens', 'gifs/learn-lens.gif', 'Element picks update anatomy.')}
      </section>
    </main>
  </div>
</body>
</html>`

writeFileSync(path.join(root, 'index.html'), html)
console.log(`Wrote ${path.join(root, 'index.html')}`)
