# 04: Harden the host teach run path

Status: done
Type: task
Severity: medium (host crash)

## Defects

1. `host/design-mode-host.ts:245-259` (`runTeachQuestion` close handler): `TeachAnswerSchema.answer` is `min(1)` and the parse runs synchronously inside `child.on('close')`. An agent that exits 0 with empty stdout throws a ZodError inside an EventEmitter listener — uncaught exception in the host process, and the surrounding promise never settles so the HTTP request hangs.
2. `host/design-mode-host.ts:446-449`: `POST /teach` picks `agents.find((item) => item.available)?.id ?? 'claude'`, ignoring the reviewer's chosen dispatch agent. A reviewer who selected Codex gets teach answers from Claude.
3. Low, same file ~290-299: `GET /m-web.html` (an existing html file not matched by `isMWebRoute`) serves `index.html` content. Nothing links there; fix or exclude deliberately.

## Fix

Wrap the close handler body in try/catch and settle the promise with a typed failure (empty answer → a clear "agent returned no output" error surfaced in the lens, not a crash). Accept an optional `agent` field on the teach request (Zod), default to the dispatch agent the client already tracks; document the fallback. Decide the `/m-web.html` route and record it if intentional.

## Done when

- [x] Host integration test: teach agent override that exits 0 with no stdout → HTTP response is a clean error, host process stays alive.
- [x] Teach question honors the selected dispatch agent (test with two fake agent commands).
- [x] `/m-web.html` serves the m-web entry or is explicitly rejected; recorded either way.

## Verify

`npm run verify`.

## Comments

- `runTeachQuestion` close handler wrapped in try/catch; empty stdout returns HTTP 500 with "Agent returned no output".
- `TeachQuestionRequestSchema` accepts optional `agent`; `local-host-client` sends `dispatchAgent`.
- `isMWebRoute` includes `/m-web.html`.
- Host tests: empty-stdout teach error + cursor agent honor.
