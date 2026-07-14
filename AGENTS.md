# Agent map

This repository is a local design review canvas. It produces agent neutral review data. CMUX, Codex, Claude Code, Pi, Grok, and OpenCode belong behind command adapters.

Start the web app at `src/app/main.tsx`. Product code lives under `src/features`. Pressure test data lives under `src/test-support`. Browser flows live under `e2e`.

Follow these rules:

1. Put code under the feature that owns it.
2. Do not create `utils`, `helpers`, `common`, `core`, or `lib` folders under `src`.
3. Name files after the work they perform. Avoid vague files such as `types.ts` and `service.ts`.
4. Use Zod schemas for stored data and messages that cross a process or browser boundary. Infer TypeScript types from schemas.
5. Keep unit tests beside the code they verify. Group browser tests by user flow under `e2e`.
6. Comments explain a constraint or decision. They do not restate the code.
7. Do not add Markdown that describes the current implementation. Code, schemas, and tests are the source of truth. Put approved future behavior in `specs`.
8. Use issue tracker items for task state when a tracker exists. Otherwise use `tickets.md` for task state and local specs with an explicit status. Do not leave `TODO` or `FIXME` comments in the repository.
9. Record rejected options or expensive choices in `DECISIONS.md`.
10. Do not add empty feature folders or abstractions for future work.
11. Run `npm run verify` before handing off a change.
