# Session API Boundary Report

## Summary

This step adds a narrow authenticated session API boundary for workspace-owned sessions.
It is one backend API boundary slice only.

No UI wiring, no tutor behavior change, no cloud runtime claims.

## Branch

`feat/session-api-boundary`

## Endpoint contract

### `POST /api/sessions`

Creates a new session under an existing workspace owned by the authenticated user.

Request body:

```json
{
  "workspaceId": "string",
  "title": "string (optional)",
  "workMode": "WorkMode (optional)",
  "costMode": "CostMode (optional)",
  "activeTopic": "string (optional)"
}
```

Success response (`201`):

```json
{
  "session": {
    "id": "string",
    "workspaceId": "string",
    "title": "string (optional)",
    "workMode": "Learning | Practice | Research | Build | Temporary Chat",
    "costMode": "Cheap Practice | Normal Learning | Deep Research",
    "activeTopic": "string (optional)",
    "status": "active",
    "startedAt": "ISO datetime",
    "lastActiveAt": "ISO datetime"
  }
}
```

Error shape/status intent:
- `400` invalid request body (missing/invalid `workspaceId`, malformed payload)
- `401` missing or invalid Bearer auth
- `404` workspace not found for authenticated user
- `503` Firestore emulator unavailable (if repository boundary cannot connect)

### `GET /api/sessions?workspaceId=<id>`

Lists sessions for a workspace owned by the authenticated user.

Success response (`200`):

```json
{
  "sessions": [
    {
      "id": "string",
      "workspaceId": "string",
      "title": "string (optional)",
      "workMode": "Learning | Practice | Research | Build | Temporary Chat",
      "costMode": "Cheap Practice | Normal Learning | Deep Research",
      "activeTopic": "string (optional)",
      "status": "active",
      "startedAt": "ISO datetime",
      "lastActiveAt": "ISO datetime"
    }
  ]
}
```

Error shape/status intent:
- `400` missing/invalid `workspaceId` query parameter
- `401` missing or invalid Bearer auth
- `404` workspace not found for authenticated user
- `503` Firestore emulator unavailable (if repository boundary cannot connect)

## Auth and ownership rules

- `userId` is derived only from `resolveAuthenticatedUser` and verified Bearer token context.
- Client-provided `userId` is never trusted for create/list operations.
- Workspace ownership is checked before session create/list.
- Cross-user access returns not found/denied behavior without leaking other users' data.

## Persistence boundary

- Sessions are stored under:
  - `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}`
- Repository/service pattern remains emulator-first and local-demo scoped.
- This step is not cloud-ready and does not claim Firebase production readiness.

## Explicitly out of scope in this step

- Session UI integration
- Tutor provider behavior changes
- `POST /api/tutor` changes
- Gemini/Genkit/retrieval integration
- Learner memory persistence
- Storage integration
- Firebase Admin SDK or cloud project integration
- Firestore/Storage rules redesign unless separately required
- Env/secrets/project-ID provisioning

## Exact next recommended task

**Session UI integration (recommended):**
Wire the session selector and related workspace session views to:
- `POST /api/sessions`
- `GET /api/sessions?workspaceId=<id>`

Keep tutor provider mock-only during that UI slice.

**Alternative (only if UX issues are discovered during manual review):**
Run a focused manual UX redesign pass before wiring additional backend features.
