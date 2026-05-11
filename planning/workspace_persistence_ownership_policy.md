# Workspace Persistence Ownership and Write Policy

This is a planning document only. It defines ownership, read/write boundaries, and future test expectations for workspace persistence. It does not change Firestore rules, storage rules, or runtime code.

## 1. Core ownership rule

All persisted workspace data is owned by the authenticated Firebase user whose `request.auth.uid` matches the `userId` in the Firestore path.

The trusted ownership source is the verified auth identity, not client JSON, not query params, and not any user-supplied `userId` field.

### Ownership source

- Server auth routes derive the trusted `userId` from the verified Firebase ID token.
- Client-provided `userId` is never authoritative.
- If client state and auth state disagree, the server must trust auth and ignore the client value.
- Any future Firestore rule logic should continue to use `request.auth.uid == userId` as the ownership check.

## 2. Boundary model

All persisted app data should live under `users/{userId}/...`.

Within that boundary:

- client-readable means the signed-in owner may load their own data
- client-writable means the signed-in owner may create or update only the fields that the product explicitly allows
- server-owned means only trusted backend code may create or update the document or the sensitive fields in it

The planning direction is not "everything is writable if you own it." Some records are owned by the user, but still have server-owned fields or server-owned write phases.

## 3. Collection policy

### `users/{userId}/workspaces/{workspaceId}`

Ownership:
- owned by the authenticated user

Client CRUD:
- create: allowed for the owner
- read: allowed for the owner
- update: allowed for the owner for user-editable fields like `name`, `description`, and `status`
- delete: allowed for the owner only if the product supports explicit deletion; otherwise prefer archive/soft-delete first

Server-owned behavior:
- server may create or update derived fields such as timestamps, activity state, or future summary references
- server may enforce lifecycle status changes when deleting dependent data or performing cleanup

Notes:
- workspace documents are user-scoped metadata, not a place for content blobs or secret data
- if a workspace is deleted, its sessions, messages, and related decision logs should be treated as cleanup targets or made inaccessible through a clear retention policy

### `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}`

Ownership:
- owned by the authenticated user through the workspace path

Client CRUD:
- create: allowed for the owner
- read: allowed for the owner
- update: allowed for the owner for safe session metadata such as `title`, `status`, or UI preferences
- delete: allowed only if the product explicitly supports deleting sessions; otherwise prefer archival

Server-owned behavior:
- server writes session activity fields such as `messageCount`, `lastMessageAt`, summaries, or internal state derived from message flow
- server may create sessions during tutor interaction even when the client only initiated a message

Notes:
- sessions are the control plane for a transcript, not the transcript itself
- session history should not be flattened into the session document

### `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}/messages/{messageId}`

Ownership:
- owned by the authenticated user through the session and workspace path

Client CRUD:
- create: allowed only for user-authored message records that represent the signed-in user’s own input
- read: allowed for the owner
- update: not generally allowed for client code once persisted, except possibly for limited draft or status fields if a future product decision needs it
- delete: not generally allowed for client code; favor append-only transcripts and explicit archival or redaction flows instead

Server-owned behavior:
- server creates assistant, system, or tool message records
- server may update message metadata such as citations, status, or tool-call references
- server may redact or archive messages only under explicit retention or safety policy

Notes:
- messages should stay append-only by default
- any future edit/delete capability should be treated as a product decision, not a convenience default

### `users/{userId}/decisionLog/{entryId}`

Ownership:
- logically owned by the authenticated user, but operationally server-owned

Client CRUD:
- create: not allowed
- read: not allowed by default in the current product direction
- update: not allowed
- delete: not allowed

Server-owned behavior:
- server creates decision log entries from routing, retrieval, memory, or summary decisions
- server may update internal fields before finalizing an entry if the implementation needs a two-step write
- server may prune or retain entries according to future retention policy

Notes:
- decision log entries are private technical records, not user-facing content
- if a later product decision allows user export or debug visibility, that should be explicit and narrowly scoped

## 4. Server-owned vs client-readable/writable boundaries

Client-readable and client-writable data should be limited to safe user-owned metadata and transcript content that the product explicitly needs.

Server-owned data should cover:

- decision log entries
- derived session state
- message metadata written by the tutor pipeline
- cleanup or archival markers
- future indexing or summary pointers

Client code must never be trusted to declare ownership, rewrite the auth identity, or mark another user’s documents as its own.

## 5. Retention and deletion notes

This is planning-level guidance, not an active retention policy.

- Prefer soft-delete or archive states before hard deletion when the product still needs auditability.
- Keep transcripts and decision logs consistent with the workspace/session lifecycle.
- Do not auto-delete meaningful sessions or workspace history without an explicit product decision.
- If a workspace is deleted, decide whether child sessions and messages are cascaded, archived, or retained for a bounded period; the policy should be explicit before implementation.
- Temporary or ephemeral chat modes should not create durable persistence unless the user has explicitly chosen a mode that allows it.
- Decision logs may need longer retention than session messages because they explain system behavior, but they remain private and server-owned.

## 6. Alignment with existing `firestore.rules` direction

This policy matches the current rules direction:

- `isOwner(userId)` is based on `request.auth.uid == userId`
- the current draft allows access only inside `/users/{userId}/{document=**}`
- cross-user access should remain blocked
- unauthenticated access should remain blocked

This document does not change the rules file. It only states the intended ownership model so later rule tightening can split broad user-owned access into safer collection-level behavior.

The current broad owner-only rule is acceptable as a first-pass emulator direction, but future production rules should still reflect the narrower read/write expectations in this document, especially for decision logs and server-owned session/message fields.

## 7. Future Firestore rule-test cases needed

The later rules suite should add cases for:

- authenticated user can create, read, update, and delete their own workspace document
- authenticated user cannot read or write another user’s workspace document
- authenticated user can create, read, and update their own session document
- authenticated user cannot read or write another user’s session document
- authenticated user can create and read their own message documents in the expected session path
- authenticated user cannot create or read messages in another user’s workspace or session
- authenticated user cannot update or delete server-owned message records unless the policy explicitly allows it
- authenticated user cannot create, read, update, or delete decision log entries through client rules
- unauthenticated requests are denied for every path above
- requests outside `/users/{userId}/...` are denied
- path ownership is enforced from `request.auth.uid`, not from any client-provided `userId`
- if field-level protection is later added, client writes must be rejected when they attempt to modify server-owned fields such as decision log content, server timestamps, or derived session counters

## 8. Planning status

This policy is a design target for the persistence layer and Firestore rules work that follows.

It should be used to guide implementation, test design, and rule tightening, but it is not itself an active authorization layer.
