# Decisions

## 2026-07-14: Keep agent integrations at the edge

Status: Accepted

Decision: The canvas writes a validated review batch. A local service will pass that batch to a selected command adapter.

Reason: The review data must work with CMUX, Codex, Claude Code, Pi, Grok, OpenCode, and later coding agents without changing the canvas model.

Rejected: Calling one coding agent directly from the canvas.

Revisit when: A target cannot consume the shared review batch without losing required context.

## 2026-07-14: Use React Flow as the default canvas engine

Status: Accepted

Decision: Use React Flow for the first product implementation. Keep Excalidraw as an optional adapter.

Reason: The 50 screen browser test found a smaller initial bundle and a simpler path for DOM based screens, anchored annotations, and an in place live iframe.

Rejected: Excalidraw as the default. tldraw as a shipped dependency because its current production license does not fit this public open source project.

Revisit when: Freeform drawing matters more than direct interaction with screen frames, or the license requirement changes.

## 2026-07-14: Keep one package until the local service exists

Status: Accepted

Decision: Keep the current application in one package. Organize it by feature.

Reason: Empty packages would describe planned code instead of helping agents navigate working code.

Rejected: Creating canvas, service, and protocol workspaces before two runtimes exist.

Revisit when: The first local service process and its shared message schema are implemented.

## 2026-07-14: Let executable contracts describe the implementation

Status: Accepted

Decision: Use feature folders, precise names, Zod schemas, and tests as the implementation record. Keep prose to navigation and decisions.

Reason: Explanatory architecture documents can disagree with changing code.

Rejected: Maintaining a separate description of the current source tree and behavior.

Revisit when: A stable domain term needs a short glossary.
