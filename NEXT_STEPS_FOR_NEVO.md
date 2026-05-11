# Next Steps For Nevo

## Immediate next step

Implement workspace persistence in emulator-only mode with a strict first slice:

- workspace documents
- session documents
- message append/list documents
- decision-log write contract

No other persistence domains should be added in that PR.

## Required scope for the next implementation PR

1. Keep `POST /api/tutor` auth-protected and preserve current mock tutor behavior.
2. Add only workspace/session/message persistence boundaries and decision-log write path wiring.
3. Enforce trusted auth ownership (`uid`) for all reads/writes.
4. Keep Firestore writes local-emulator only for this phase.
5. Add focused tests for ownership checks and write ordering.

## Explicitly out of scope for that PR

- Storage upload integration
- Gemini integration
- Genkit integration
- retrieval integration
- learner memory persistence
- academic knowledge persistence
- cloud Firebase connection
- secrets and env files

## Sequencing guardrails

1. Keep Codex as primary agent for implementation.
2. Use Aider + DeepSeek only if Codex is interrupted.
3. Keep package changes minimal and only if strictly required.
4. Do not broaden to dashboard/account-system work.

## Decisions to lock before implementation

1. First persistence order inside the slice:
   - workspace-first
   - session-first
2. Decision-log location for phase one:
   - user-level with workspace/session references (recommended)
   - workspace-scoped
3. Session retention default:
   - archive-first
   - immediate hard delete support

## Readiness note

Workspace persistence boundary planning is complete enough to start a narrow emulator-only implementation PR for workspace/session/message persistence and decision-log write contracts.
