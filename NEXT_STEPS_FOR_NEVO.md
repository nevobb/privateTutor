# Next Steps For Nevo

## Immediate next step

**Focused UX redesign pass for workspace/session/tutor layout (recommended)**

Session API boundary and session UI wiring now exist:
- `POST /api/sessions`
- `GET /api/sessions?workspaceId=<id>`

### Recommended now

1. Run a focused visual/interaction cleanup for workspace/session/tutor layout only.
2. Keep the newly wired session flow intact (load sessions on workspace change, create session, active session state).
3. Improve usability and clarity in RTL flow without expanding backend scope.
4. Keep tutor provider mock-only during the redesign pass.

### Alternative next step (only if redesign is intentionally deferred)

Add the next backend boundary for session transcript/messages.

---

## Route decision recorded (GAP-005)

`POST /api/tutor` is the canonical tutor endpoint. `/api/tutor/respond` is not created — the path follows Next.js App Router resource convention. This divergence from early spec planning is accepted. A DECISION_LOG entry will be added in a future cleanup PR.

---

## After focused redesign pass

### Session transcript/message API boundary

Add the next narrow backend slice for session transcript boundaries (list/create session messages through authenticated, workspace-owned paths).

---

## Explicitly out of scope until after focused redesign pass

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
