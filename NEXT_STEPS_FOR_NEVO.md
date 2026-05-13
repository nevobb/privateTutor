# Next Steps For Nevo

## Immediate next step

**Session UI integration (recommended)**

Session API boundary is now available:
- `POST /api/sessions`
- `GET /api/sessions?workspaceId=<id>`

### Recommended now

1. Wire the session selector to `GET /api/sessions?workspaceId=<id>`.
2. Add session creation flow via `POST /api/sessions` when user starts a new session.
3. Keep user identity server-owned (Bearer token only), no client `userId` trust.
4. Keep tutor provider mock-only while integrating session UI.

### Alternative next step (only if UX friction is observed)

Run a focused manual UX redesign pass for session/workspace flow before adding more backend surface area.

---

## Route decision recorded (GAP-005)

`POST /api/tutor` is the canonical tutor endpoint. `/api/tutor/respond` is not created — the path follows Next.js App Router resource convention. This divergence from early spec planning is accepted. A DECISION_LOG entry will be added in a future cleanup PR.

---

## After session UI integration

### Session transcript/message API boundary

Add the next narrow backend slice for session transcript boundaries (list/create session messages through authenticated, workspace-owned paths).

---

## Explicitly out of scope until after session UI integration

- Message/transcript persistence UI
- Firebase cloud connection
- Firebase Admin SDK
- Storage, Gemini, Genkit, retrieval
- Learner memory persistence
- Academic knowledge persistence

## Sequencing guardrails

1. Keep Codex as primary agent.
2. Use Aider + DeepSeek only if Codex is interrupted.
3. Keep package changes minimal.
4. Keep the tutor response provider mock-only.
5. Do not claim production readiness.
