# Workspace API Boundary

## Overview

This document describes the workspace REST API boundary implemented in this repository. All endpoints operate against the Firestore emulator only. No Firebase cloud connection is established or implied.

---

## Implemented Endpoints

### POST /api/workspaces

Creates a new workspace owned by the authenticated user.

**Required fields:**
- `name` (string) — workspace display name

**Optional fields:**
- `description` (string)
- `path` (string)
- `parentWorkspaceId` (string)
- `stableIdentityNote` (string)

**Success response:** `201 Created` with the created workspace document.

---

### GET /api/workspaces

Lists all workspaces owned by the authenticated user, ordered by `updatedAt` descending.

**Success response:** `200 OK` with an array of workspace documents.

---

### GET /api/workspaces/[workspaceId]

Retrieves a single workspace by ID. Only the owning user may access it.

**Success response:** `200 OK` with the workspace document.

---

## Auth Rule

The `userId` is always derived from the trusted auth context:

1. Client sends a Bearer token in the `Authorization` header.
2. The Firebase token verifier validates the token and extracts `uid`.
3. That `uid` is used as `ownerId` for all read and write operations.

**Client-provided `userId` in the request body is never trusted or used.**

---

## Error Responses

| Status | Meaning |
|--------|---------|
| 401 | Missing or invalid Bearer token |
| 400 | Invalid request payload (e.g., missing required `name`) |
| 404 | Workspace not found, or not owned by the requester |
| 503 | Firestore emulator unavailable |
| 500 | Unexpected internal error |

---

## Emulator-First Constraint

- This implementation targets the `demo-private-tutor` Firebase emulator project only.
- No Firebase cloud project credentials are configured or required.
- The Firestore emulator must be running locally for emulator tests to pass.
- If the emulator is unavailable, the service returns `503`.

---

## Out of Scope

The following are explicitly not part of this boundary:

- `PATCH /api/workspaces/[workspaceId]` — update workspace (not in this PR)
- `DELETE /api/workspaces/[workspaceId]` — delete workspace (not in this PR)
- Firebase Admin SDK integration
- Firebase Storage
- Gemini or Genkit
- Retrieval or semantic search
- Learner memory or academic knowledge base
- Any UI components

---

## Tests

### Unit Tests (no emulator required)

Run with the standard test command:

```
npx vitest run
```

These tests mock the Firestore layer and verify request validation, auth enforcement, and response shape.

### Emulator Tests

Require a running Firestore emulator. Activated with the environment flag:

```
FIREBASE_WORKSPACE_API_EMULATOR_TEST=1 npx vitest run
```

These tests exercise real Firestore reads and writes against the local emulator.

---

## Production Readiness

This implementation makes no production readiness claims. It is scoped to local development and emulator-based testing only.
