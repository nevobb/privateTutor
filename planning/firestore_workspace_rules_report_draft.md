# Firestore Workspace Rules - Planning Draft

## 1. What Was Done

Firestore security rules were written and validated against the Firebase Local Emulator Suite for the workspace persistence paths introduced in the workspace persistence feature branch. The rules tighten access to four specific path groups under `users/{userId}/`, replacing any open or broad wildcard rules that could grant unintended access.

Collections not yet implemented (learnerMemory, academicKnowledge, uploadedFiles, etc.) are explicitly excluded by using an enumerated match approach rather than a broad wildcard.

---

## 2. Tested Allow/Deny Cases

### workspaces path

| Case | Expected | Result |
|------|----------|--------|
| Authenticated owner creates workspace with valid fields | Allow | Pass |
| Authenticated owner reads own workspace | Allow | Pass |
| Authenticated owner updates own workspace | Allow | Pass |
| Authenticated owner deletes own workspace | Allow | Pass |
| Unauthenticated user creates workspace | Deny | Pass |
| Authenticated user creates workspace for different userId | Deny | Pass |
| Create without required `ownerId` field | Deny | Pass |
| Create with `ownerId` not matching auth uid | Deny | Pass |

### sessions path

| Case | Expected | Result |
|------|----------|--------|
| Authenticated owner creates session with valid fields | Allow | Pass |
| Authenticated owner reads own session | Allow | Pass |
| Unauthenticated user creates session | Deny | Pass |
| Create session with mismatched `workspaceId` field | Deny | Pass |

### messages path

| Case | Expected | Result |
|------|----------|--------|
| Authenticated owner creates message with valid fields | Allow | Pass |
| Authenticated owner reads own message | Allow | Pass |
| Authenticated owner attempts to update existing message | Deny | Pass |
| Authenticated owner attempts to delete message | Deny | Pass |
| Create message with invalid role value | Deny | Pass |
| Unauthenticated user creates message | Deny | Pass |

### decisionLog path

| Case | Expected | Result |
|------|----------|--------|
| Authenticated owner creates decisionLog entry with valid fields | Allow | Pass |
| Authenticated owner reads own decisionLog entry | Allow | Pass |
| Authenticated owner attempts to update decisionLog entry | Deny | Pass |
| Authenticated owner attempts to delete decisionLog entry | Deny | Pass |
| Unauthenticated user creates decisionLog entry | Deny | Pass |

### Enumerated collection isolation

| Case | Expected | Result |
|------|----------|--------|
| Access attempt to learnerMemory subcollection | Deny | Pass |
| Access attempt to academicKnowledge subcollection | Deny | Pass |
| Access attempt to uploadedFiles subcollection | Deny | Pass |

---

## 3. DecisionLog Emulator-Phase Tradeoff

The Decision Log is logically a server-owned resource. In the intended production architecture, all writes to `decisionLog` would go through a trusted Firebase Admin SDK endpoint (a server-side function or API route), and client-side rules would deny all writes.

During the emulator phase, no Admin SDK write path exists. The server-side API route for Decision Log has not been implemented yet. To allow emulator tests to exercise Decision Log creation without building the full backend first, the rules temporarily permit owner create and read from the client. Update and delete remain denied.

This tradeoff was chosen because:
- It unblocks emulator-phase testing without requiring a full backend implementation.
- It limits the exposure: only the authenticated owner can write, and only create (not update or delete) is allowed.
- The intent to migrate to server-only writes is explicitly documented so it is not forgotten.

---

## 4. What Production Hardening Requires

To harden the Decision Log path for production:

1. Implement a Firebase Admin SDK server endpoint (API route or Cloud Function) that validates and writes Decision Log entries.
2. Change the `decisionLog` rules to deny all client-side writes (`allow read: if request.auth.uid == userId; allow write: if false;`).
3. All writes go through the trusted server endpoint, which bypasses client-side rules via Admin SDK.

For all other paths, additional production hardening considerations include:

- Rate limiting via App Check.
- Field value size limits (max string lengths) to prevent abuse.
- Server-side timestamp enforcement using `request.time` instead of client-supplied `createdAt`.
- Audit of subcollection enumeration as new features are added.

---

## 5. Scope Constraints Honored

- Emulator-only. No cloud deployment performed.
- Project: `demo-private-tutor` only.
- No secrets, no env files, no cloud connections.
- No Storage rules.
- No Gemini, Genkit, or retrieval integration.
- No learner memory paths opened.
- No production readiness claimed.
- Changes limited to Firestore rules and documentation. No application code modified.
