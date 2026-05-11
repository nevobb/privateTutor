# Workspace Persistence Implementation Report Draft

## Summary

This draft captures the first emulator-only workspace persistence implementation slice.

It adds a narrow server-side persistence boundary for workspaces, sessions, messages, and decision-log writes while keeping the tutor provider mock-only.

## Implemented boundary

Implemented components:

- Firestore emulator boundary (`src/server/firebase/*`)
- Workspace/session/message/decision-log repositories (`src/server/workspaces/*`)
- Workspace persistence orchestration service
- `POST /api/tutor` integration through the service

Implemented write/read paths:

- `users/{userId}/workspaces/{workspaceId}`
- `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}`
- `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}/messages/{messageId}`
- `users/{userId}/decisionLog/{entryId}`

## Emulator-first behavior

- Uses local demo project ID `demo-private-tutor`.
- Uses Firestore emulator `127.0.0.1:8080`.
- No Firebase cloud fallback.
- Clear failure when emulator is unavailable.

## Route behavior

After auth and request validation, route persistence flow is:

1. ensure workspace exists
2. ensure session exists
3. append user message
4. run existing mock tutor handler
5. append tutor message
6. write decision log entry

Auth protections (`401`/`403`) remain unchanged.

## Test posture

- Default `npx vitest run` remains emulator-independent.
- Emulator-only tests are explicitly gated by `FIREBASE_WORKSPACE_EMULATOR_TEST=1`.
- Added explicit workspace emulator test scripts.

## Out of scope

- Firebase cloud connection
- Storage upload
- Gemini/Genkit
- retrieval
- learner memory persistence
- academic knowledge persistence
- production readiness claims
