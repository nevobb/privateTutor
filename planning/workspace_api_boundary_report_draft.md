# Workspace API Boundary — Planning Draft

## 1. What Was Done

### Endpoints

Three workspace REST endpoints were implemented:

- `POST /api/workspaces` — creates a workspace. Requires `name`. Accepts optional `description`, `path`, `parentWorkspaceId`, and `stableIdentityNote`.
- `GET /api/workspaces` — lists all workspaces owned by the authenticated user, ordered by `updatedAt` descending.
- `GET /api/workspaces/[workspaceId]` — retrieves a single workspace. Returns 404 if not found or not owned by the requester.

### Validation

Request payloads are validated at the route layer before reaching the service. Missing required fields (e.g., `name` on POST) return a `400` response with a descriptive error message.

### Service Layer

A workspace service encapsulates Firestore interactions. The service is responsible for:

- Writing new workspace documents to Firestore.
- Querying workspaces by owner.
- Fetching individual workspace documents by ID and verifying ownership.

### Routes

Route handlers extract the validated user identity from the auth context and delegate to the workspace service. They do not accept or process user-supplied identity claims from request bodies.

---

## 2. Auth Derivation Pattern

The authentication flow is:

1. Client attaches a Firebase ID token as a Bearer token in the `Authorization` header.
2. The route middleware passes the token to the Firebase token verifier.
3. The verifier returns the decoded token, from which `uid` is extracted.
4. That `uid` is used as the `ownerId` for all workspace operations.

At no point does the server accept a `userId` from the request body or query parameters. This prevents client-side identity spoofing.

---

## 3. Firestore Emulator-Only Behavior

- All Firestore interactions target the local `demo-private-tutor` emulator project.
- No cloud Firebase credentials are used or required.
- If the emulator is not reachable, the service surfaces a `503 Service Unavailable` response rather than silently failing or attempting a cloud fallback.
- This constraint is intentional and keeps the development environment fully offline.

---

## 4. Scope Constraints Honored

The following constraints from `AGENTS.md` and the task definition were respected:

- No API keys or secrets were committed.
- No external services were connected.
- No Firebase Admin SDK was introduced.
- No Firebase Storage, Gemini, or Genkit code was added.
- No learner memory or academic knowledge base was touched.
- No UI components were created or modified.
- Changes were kept to the smallest useful scope.

---

## 5. What Was Deferred

The following items are out of scope for this PR and are deferred to future work:

- `PATCH /api/workspaces/[workspaceId]` — workspace update endpoint
- `DELETE /api/workspaces/[workspaceId]` — workspace deletion endpoint
- Firebase Admin SDK setup for production token verification
- Connection to a real Firebase cloud project
- Any retrieval, search, or embedding features
- Learner memory integration
- Academic knowledge base integration
