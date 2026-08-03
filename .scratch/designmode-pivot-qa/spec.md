---
title: Designmode pivot QA — bug fixes and fidelity corrections from the execution review
status: done
---

# PRD: pivot QA wave

The fifteen pivot tickets in `.scratch/designmode-pivot/` are done and `npm run verify` is green (33 e2e, detector scan clean). A four-track review (code correctness, constraint audit, design critique against the binding screens, deterministic detector) found real bugs the gates did not catch, plus fidelity breaks against `design/screens/*.html`. This wave fixes them.

## Review provenance

- Correctness review of the working-tree diff (islands, blooms, learn lens, m-web, host).
- Constraint audit: deps PASS, token fidelity PASS, React Flow styling PASS, bundle guard PASS, hygiene PASS; testid preservation PARTIAL (one removed id), WCAG PARTIAL (one component failure), motion PARTIAL (one duration bug).
- Design critique (impeccable method, product register): 27/40 heuristics; visual system landed, not slop; main faults are two doctrine breaks against the binding screens and developer-harness residue in product chrome.
- House preferences audit against `~/Documents/work/claude-design/skill-lab/PREFERENCES.md`: the DLS token curves win where they conflict; deltas recorded per ticket.

## Binding rules (unchanged from the pivot)

Same hard constraints as `.scratch/designmode-pivot/spec.md`: zero new runtime dependencies, gzip cap via `npm run measure`, every `data-testid` and ARIA name preserved (any e2e contract change is listed in the ticket and recorded in `DECISIONS.md`), ready-ms bound, React Flow styled only via its CSS variables, WCAG AA both themes, `npm run verify` before any ticket is done. Screen file wins over `design/HANDOFF.md`; deviations go to `DECISIONS.md`.

## Order

Work tickets in number order. 01–06 are functional bugs (severity order). 07–11 are design-system debt and fidelity corrections. 10 is blocked by 08 (both edit the bloom).

## Acceptance for the wave

- [x] All eleven issues `Status: done` with acceptance checked and evidence under `## Comments`.
- [x] `npm run verify` green at the close of 06 (bug gate) and 11 (design gate).
- [x] The bloom matches `design/screens/review-dispatch.html` including the compose foot, or the deviation is honestly recorded in `DECISIONS.md` after an explicit user decision.
