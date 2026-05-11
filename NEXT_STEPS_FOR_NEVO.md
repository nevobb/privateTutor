# Next Steps For Nevo

## Immediate next step

Define the workspace API boundary — HTTP endpoints for workspace CRUD operations.

Suggested scope for that PR:
- `POST /api/workspaces` — create workspace
- `GET /api/workspaces` — list owner's workspaces
- `GET /api/workspaces/:id` — get single workspace
- Auth-verified userId derivation (trust the token, not client-provided userId)
- Tests against the Firestore emulator with auth token injection
- No Firebase cloud, no real Admin token verification yet

## Why this is next

Firestore workspace rules are now tightened and emulator-tested. The next safe step
is defining the HTTP API contract before wiring any UI. This keeps the implementation
incremental and ensures the route surface matches the Firestore ownership model before
client state management is added.

## Explicitly out of scope for that PR

- Firebase cloud connection
- Real Firebase Admin SDK token verification
- Storage upload integration
- Gemini integration
- Genkit integration
- Retrieval integration
- Learner memory persistence
- Academic knowledge persistence
- UI component wiring

## Sequencing guardrails

1. Keep Codex as primary agent.
2. Use Aider + DeepSeek only if Codex is interrupted.
3. Keep package changes minimal and only if strictly required.
4. Keep the tutor response provider mock-only.
5. Do not claim production readiness.

## Readiness note

The repo is ready for workspace API boundary implementation as the safest next step
after Firestore rules tightening.
