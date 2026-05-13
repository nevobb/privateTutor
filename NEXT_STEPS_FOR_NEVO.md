# Next Steps For Nevo

## Immediate next step

**PR 33B — Structured mock tutor response**

Domain types are now spec-aligned. The next step is wiring `TutorInternalUpdate` into the mock tutor response pipeline.

### What PR 33B changes

1. `src/lib/tutor.ts` — update `getMockTutorResponse` to return `TutorInternalUpdate` instead of flat `internalUpdates`; add optional `conversationHistory` parameter stub
2. `src/types/index.ts` — update `TutorResponse` shape: add `internalUpdate: TutorInternalUpdate`, remove legacy `internalUpdates` and `mockRouting`
3. `src/server/tutor/schemas.ts` — update `validateTutorResponse` for new `TutorResponse` shape
4. `src/server/tutor/mockTutorProvider.ts` — map to new internal update shape
5. `tests/server/tutor.handler.test.ts` — update for new shape

No Gemini. No retrieval. Provider stays mock-only.

### What PR 33C changes (after 33B)

Rewrite `tests/behavior.test.ts` to validate `internalUpdate.*` semantic fields instead of Hebrew string content.
Add coverage for spec behavior tests T001–T013 from `docs/09_Behavior_Regression_Test_Suite.md`.

---

## Route decision recorded (GAP-005)

`POST /api/tutor` is the canonical tutor endpoint. `/api/tutor/respond` is not created — the path follows Next.js App Router resource convention. This divergence from early spec planning is accepted. A DECISION_LOG entry will be added in a future cleanup PR.

---

## After 33B + 33C

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
