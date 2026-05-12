# Next Steps For Nevo

## Immediate next step

UI workspace integration — wire the workspace list and workspace creation to the
new `GET /api/workspaces` and `POST /api/workspaces` API routes.

Smallest safe UI slice for the next PR:
1. Replace static mock workspace data with a real fetch from `GET /api/workspaces`
2. Add a workspace creation flow that calls `POST /api/workspaces`
3. Keep existing mock tutor provider and session flow unchanged
4. No file upload, no retrieval, no memory, no Gemini, no Genkit

## Why this is next

The workspace API boundary is now in place with auth-verified userId derivation,
Firestore emulator persistence, and full unit + emulator test coverage. The next
safe step is to wire the UI to the real API so workspace state becomes durable.

## Scope for that PR (keep narrow)

1. Workspace list loading from `GET /api/workspaces` on page load
2. Workspace creation via `POST /api/workspaces`
3. Workspace selection (switching active workspace)
4. No session UI changes yet
5. No tutor provider change
6. No file upload integration

## Explicitly out of scope for that PR

- Session creation UI (wire later)
- Message/transcript UI persistence (wire later)
- Firebase cloud connection
- Firebase Admin SDK
- Storage upload
- Gemini, Genkit, retrieval
- Learner memory persistence
- Academic knowledge persistence

## Sequencing guardrails

1. Keep Codex as primary agent.
2. Use Aider + DeepSeek only if Codex is interrupted.
3. Keep package changes minimal.
4. Keep the tutor response provider mock-only.
5. Do not claim production readiness.

## Readiness note

The repo is ready for UI workspace integration as the next step after the workspace
API boundary is in place.
