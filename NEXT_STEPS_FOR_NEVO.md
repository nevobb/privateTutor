# Next Steps For Nevo

## Immediate next step

Manual browser smoke test of the full local workspace flow.

### What to verify

1. Start the Firebase Auth emulator: `firebase emulators:start --only auth,firestore`
2. Start the dev server: `npm run dev`
3. Open the browser at `http://localhost:3000`
4. Sign in with Google (Auth emulator intercepts — uses emulator sign-in flow)
5. Workspace list loads from `GET /api/workspaces` (returns empty list for new user)
6. Create a workspace via the "+ מרחב חדש" button
7. Workspace appears in the selector
8. Refresh — workspace persists (loaded from Firestore emulator on next sign-in)

### If sign-in fails

- Check Auth emulator is running at `http://127.0.0.1:9099`
- Check Firestore emulator is running at `http://127.0.0.1:8080`
- Check browser console for 401 or 503 errors

## After the smoke test

### Session API boundary (next PR)

Wire session creation and selection to a new `/api/sessions` API boundary.
This is the next persistence slice after workspaces:
- `POST /api/sessions` — create session within a workspace
- `GET /api/sessions?workspaceId=<id>` — list sessions for a workspace
- Keep tutor provider mock-only

### Then: Session UI integration

Wire the session selector in the UI to the session API.

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

## Readiness note

The repo is ready for a manual browser smoke test. If the smoke test passes,
the session API boundary is the next implementation step.
