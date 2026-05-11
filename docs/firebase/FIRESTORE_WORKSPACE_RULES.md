# Firestore Workspace Rules

## Scope

Emulator-only. Project: demo-private-tutor.
No cloud connection. No secrets. No env files. No Storage. No Gemini. No Genkit. No retrieval. No learner memory.
These rules are NOT production-ready.

---

## Paths Covered

### 1. `users/{userId}/workspaces/{workspaceId}`

**Allowed operations:** create, read, update, delete

**Path identity check:** `request.auth.uid == userId`

**Field validation on create/update:**
- `ownerId` must equal `request.auth.uid`
- `title` must be a string
- `createdAt` must be a timestamp

---

### 2. `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}`

**Allowed operations:** create, read, update, delete

**Path identity check:** `request.auth.uid == userId`

**Field validation on create:**
- `workspaceId` must equal the path segment `workspaceId`
- `createdAt` must be a timestamp

---

### 3. `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}/messages/{messageId}`

**Allowed operations:** create, read

**Path identity check:** `request.auth.uid == userId`

**Field validation on create:**
- `role` must be one of: `"user"`, `"model"`
- `content` must be a string
- `createdAt` must be a timestamp

Update and delete are denied to preserve message history integrity.

---

### 4. `users/{userId}/decisionLog/{entryId}`

**Allowed operations:** create, read

**Path identity check:** `request.auth.uid == userId`

**Field validation on create:**
- `title` must be a string
- `createdAt` must be a timestamp

**Tradeoff - emulator phase:**
Logically, the Decision Log is server-owned (writes should go through a trusted backend using Firebase Admin SDK). However, during the emulator phase, no Admin SDK or server-side write path exists. To allow the emulator tests to exercise Decision Log writes without wiring a backend, the rules permit owner create and read. Update and delete are denied. Production hardening requires moving all Decision Log writes to a Firebase Admin SDK endpoint and removing owner write access from client-side rules.

---

## Enumerated Subcollection Approach

Collections under `users/{userId}/` are listed explicitly rather than using a broad wildcard match. Collections enumerated:

- `workspaces`
- `decisionLog`

Collections intentionally left unmatched (no access granted by default):

- `learnerMemory`
- `academicKnowledge`
- `uploadedFiles`
- Any other future collections

This approach ensures that adding a new collection does not accidentally inherit access grants from an existing wildcard rule.

---

## Constraints

- Emulator-first. Rules are applied only against the Firebase Local Emulator Suite.
- Project: `demo-private-tutor` only.
- No cloud deployment of these rules has been performed.
- No Storage rules are covered here.
- No Gemini, Genkit, or retrieval integration.
- No learner memory paths are opened.
- These rules do not represent production security hardening.
