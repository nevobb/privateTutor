# Next Steps For Nevo

## Immediate next step

**Manual browser smoke test (recommended before more backend expansion)**

PR 33C is done: behavior regression tests now validate structured `internalUpdate` semantics.

### Recommended now

1. Run a manual browser smoke test on the tutor flow (desktop RTL layout + mock tutor responses) to confirm user-facing behavior is still sane after the behavior test rewrite.
2. Verify work mode / cost mode switches still produce expected conversational output at a UX level.

### Alternative next backend step

If smoke test is clean, proceed to the **Session API boundary**:
- `POST /api/sessions` — create session within a workspace
- `GET /api/sessions?workspaceId=<id>` — list sessions for a workspace
- Keep tutor provider mock-only

---

## Route decision recorded (GAP-005)

`POST /api/tutor` is the canonical tutor endpoint. `/api/tutor/respond` is not created — the path follows Next.js App Router resource convention. This divergence from early spec planning is accepted. A DECISION_LOG entry will be added in a future cleanup PR.

---

## After manual smoke + session boundary

### Session UI integration

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
