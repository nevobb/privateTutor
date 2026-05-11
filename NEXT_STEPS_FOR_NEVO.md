# Next Steps For Nevo

## Immediate next step

Start workspace persistence planning only. Keep Firebase Auth route protection as-is and do not begin broad Firebase runtime integration yet.

## Practical sequence

1. Confirm Auth Emulator tests pass in your local environment:
   - `npm run test:firebase:auth:emulators`
2. Keep default verifier fail-closed in runtime and continue using explicit local test verification only.
3. Plan workspace persistence boundaries (data ownership, write policy, and route contracts) before implementation.
4. Keep Firestore persistence implementation in a dedicated follow-up PR after planning is approved.
5. Keep Storage upload, Gemini, Genkit, retrieval, and learner memory persistence out of the next implementation PR.

## Decisions Nevo must make before workspace persistence implementation

1. First persisted entity order (workspace shell first vs session-first flow).
2. Initial retention policy for session and decision-log records.
3. Whether workspace creation must require authenticated users from day one.
4. Rollout preference: emulator-only persistence milestone before any cloud planning.

## Do not do yet

- Do not connect Firebase cloud or add cloud credentials.
- Do not add Firestore writes in the tutor route yet.
- Do not add Storage upload integration.
- Do not add Gemini, Genkit, retrieval, or persistent learner memory.
- Do not add API keys, secrets, or `.env` files.

## Readiness note

The repo now has an auth-protected tutor route, explicit Auth Emulator tests, and local emulator scaffolding/rule tests. It is ready for workspace persistence planning, not broad Firebase runtime integration.

## Agent execution note

- Codex is the primary implementation agent.
- Aider + DeepSeek are fallback only if Codex is interrupted or unavailable.
