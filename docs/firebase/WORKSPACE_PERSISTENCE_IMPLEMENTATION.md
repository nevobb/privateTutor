# Workspace Persistence Implementation

This document describes the first narrow workspace persistence slice implemented in emulator-only mode.

## What was implemented

The following server-side emulator-first persistence components are now in place:

- Firestore emulator boundary in `src/server/firebase/*` (demo-local only)
- Workspace repository
- Session repository
- Message repository
- Decision log repository
- Workspace persistence service used by `POST /api/tutor`

The implemented write paths are:

- `users/{userId}/workspaces/{workspaceId}`
- `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}`
- `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}/messages/{messageId}`
- `users/{userId}/decisionLog/{entryId}`

## Emulator-only boundary

- Project ID is fixed to `demo-private-tutor`.
- Firestore emulator endpoint is fixed to `127.0.0.1:8080`.
- No cloud fallback is implemented.
- If the emulator is unavailable, the server boundary fails clearly.
- No `.env` files are required.
- No real Firebase project IDs or secrets are used.

## Route behavior

`POST /api/tutor` remains auth-protected and mock-tutor-backed.  
After request/auth validation it now uses the persistence service to:

1. ensure workspace exists for trusted auth `userId`
2. ensure session exists
3. append the user message
4. call the existing mock tutor handler
5. append the tutor message
6. write a decision log entry

Auth behavior remains:

- missing/malformed/invalid auth => `401`
- spoofed `userId` mismatch => `403`

## Commands

Default checks:

```bash
npm run build
npm run lint
npx vitest run
git diff --check
```

Explicit emulator workspace tests:

```bash
npm run test:firebase:workspace:emulators
```

Optional emulator test suites:

```bash
npm run test:firebase:auth:emulators
npm run test:firebase:rules:emulators
```

## Out of scope

This slice does **not** implement:

- Firebase cloud connection
- Storage upload
- Gemini integration
- Genkit integration
- retrieval integration
- learner memory persistence
- academic knowledge persistence
- production Firebase configuration

## Status note

This is a narrow emulator-first persistence slice, not a production-ready persistence system.
