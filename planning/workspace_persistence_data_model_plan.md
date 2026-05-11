# Workspace Persistence Data Model Plan

This is a planning document only. It defines Firestore document boundaries for workspace persistence. It does not implement storage, rules, indexes, file uploads, retrieval, memory writes, or runtime code.

## Boundary rules

- All persisted app data must live under `users/{userId}/...`.
- Documents should stay lightweight and store metadata, state, and references only.
- Do not store binary file contents, learner memory, academic knowledge, or retrieval indexes in these paths.
- The goal is durable workspace state, not a content warehouse.

## `users/{userId}`

Purpose:
- user profile and top-level app state

Minimal fields:
- `displayName`
- `email` or `emailVerified` if needed for UI identity
- `activeWorkspaceId`
- `createdAt`
- `updatedAt`

Notes:
- Keep this doc small.
- Do not store secrets, provider keys, file data, or workspace content here.

## `users/{userId}/workspaces/{workspaceId}`

Purpose:
- durable workspace identity and workspace-level settings

Minimal fields:
- `name`
- `description` or `summary`
- `status` (`active`, `archived`, `deleted`)
- `createdAt`
- `updatedAt`

Optional fields, only if needed:
- `lastSessionId`
- `lastActivityAt`

Notes:
- This doc should describe the workspace, not replicate session history.
- Workspace settings should remain simple and easy to load.

## `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}`

Purpose:
- a single conversational or task session inside a workspace

Minimal fields:
- `title`
- `status` (`active`, `closed`, `archived`)
- `startedAt`
- `updatedAt`
- `messageCount`
- `lastMessageAt`

Optional fields, only if needed:
- `mode`
- `summary`
- `pinState`

Notes:
- Sessions should not store message bodies inline.
- This document is the session index and control plane, not the transcript.

## `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}/messages/{messageId}`

Purpose:
- an ordered message record for the session transcript

Minimal fields:
- `role` (`user`, `assistant`, `system`, `tool`)
- `content`
- `createdAt`
- `sequence`

Optional fields, only if needed:
- `toolName`
- `toolCallId`
- `status`
- `citations`

Notes:
- Keep each message self-contained and small.
- Do not attach file blobs, embeddings, full retrieved corpora, or durable memory payloads.

## Decision log path choice

Recommended path:
- `users/{userId}/decisionLog/{decisionId}`

Why user-level:
- many decisions apply across workspaces, not just one workspace
- the log is easier to audit as a personal technical history
- workspace-specific context can still be attached with `workspaceId` and `sessionId`
- it avoids splitting the same decision pattern across multiple workspace branches

Minimal fields:
- `decisionType`
- `title`
- `decision`
- `rationale`
- `createdAt`
- `workspaceId` or `null`
- `sessionId` or `null`

Optional fields, only if needed:
- `status`
- `author`
- `tags`

Notes:
- If a decision is truly workspace-local, the workspace references make it discoverable without changing the path.
- This keeps the collection easy to query while preserving workspace context.

## Rejected alternatives

1. `decisionLog` under each workspace
- Rejected because the same product or architectural decision may span multiple workspaces.
- It fragments the audit trail and makes cross-workspace reasoning harder.

2. Root-level collections outside `users/{userId}/...`
- Rejected because the user owns the data boundary and root-level data makes multi-user isolation harder to reason about.

3. Storing messages directly inside the session document
- Rejected because session docs would grow too large and become expensive to load or update.

4. Putting files, learner memory, academic knowledge, or retrieval indexes into these collections
- Rejected because this plan is only for workspace persistence metadata and transcript state.
- Those domains need separate planning and separate storage boundaries.

## Open questions

- Should `message.content` allow rich text, plain text only, or a small structured payload?
- Do sessions need soft-delete metadata beyond `status`?
- Should `decisionLog` support a `workspaceId` filter index from day one, or wait until a real query need appears?
- Do we want `updatedAt` on messages, or should messages stay append-only once written?

## Summary

This model keeps persistence under `users/{userId}/...`, keeps session transcripts separate from session metadata, and keeps the decision log user-level with workspace context attached when relevant. It stays narrow on purpose so the storage boundary is easy to understand and hard to misuse.
