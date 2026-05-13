# Next Steps For Nevo

## Immediate next step

Implement an emulator-compatible Firebase token verifier so workspace API calls
from the UI succeed in local development.

### Why this is the blocker

The workspace UI is now wired to `GET /api/workspaces` and `POST /api/workspaces`.
Firebase Auth client wiring is in place (auth hook, sign-in, token retrieval).
However, `src/server/auth/verifyFirebaseToken.ts` throws by default — it is not
configured to verify tokens. All API calls from the UI return 401.

### What the next step requires

Create `src/server/auth/verifyFirebaseTokenEmulator.ts` that verifies Firebase Auth
emulator tokens by calling the emulator's REST lookup endpoint:

```
POST http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-key
Body: { "idToken": "<token>" }
```

Wire this verifier into the route handlers when running with `demo-private-tutor`.
No Firebase Admin SDK is needed. No new npm packages needed (uses `fetch`).

### Scope for that PR

1. `src/server/auth/verifyFirebaseTokenEmulator.ts` — REST-based emulator verifier
2. Wire via environment detection: use emulator verifier when project is `demo-private-tutor`
3. Unit tests for the emulator verifier (mock fetch)
4. Emulator integration test proving end-to-end sign-in → workspace list works

### After that

Wire the Auth Emulator sign-in in the browser UI so Nevo can actually test:
sign in → workspace list loads → create workspace → selection persists.

## Explicitly out of scope until token verifier is done

- Session creation UI
- Message/transcript UI persistence
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

## Readiness note

The repo is ready for the emulator token verifier as the next step.
