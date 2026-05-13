# Next Steps For Nevo

## Immediate next step

**PR 33C — Behavior regression rewrite against `internalUpdate`**

PR 33B is done: mock tutor responses now return `internalUpdate` and legacy `mockRouting/internalUpdates` are removed.

### What PR 33C changes

1. Rewrite `tests/behavior.test.ts` to assert structured `internalUpdate.*` behavior semantics rather than legacy mock routing/text-only expectations.
2. Add coverage for spec behavior tests T001–T013 from `docs/09_Behavior_Regression_Test_Suite.md`.
3. Keep provider mock-only (no Gemini, no Genkit, no real retrieval, no memory persistence).

---

## Route decision recorded (GAP-005)

`POST /api/tutor` is the canonical tutor endpoint. `/api/tutor/respond` is not created — the path follows Next.js App Router resource convention. This divergence from early spec planning is accepted. A DECISION_LOG entry will be added in a future cleanup PR.

---

## After 33C

### Session API boundary

Wire session creation and selection to `/api/sessions` API boundary.
- `POST /api/sessions` — create session within a workspace
- `GET /api/sessions?workspaceId=<id>` — list sessions for a workspace
- Keep tutor provider mock-only

### Then: Session UI integration

Wire the session selector in the UI to the session API.

---

## Explicitly out of scope until after session boundary

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
