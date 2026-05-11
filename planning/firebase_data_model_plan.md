# Firebase Data Model Plan

This is a high-level Firestore planning document. It does not create Firebase config, rules, indexes, or runtime code.

## `users/{userId}`

- Purpose: user profile and current app preferences.
- Key fields: `displayName`, `activeWorkspaceId`, `defaultWorkMode`, `defaultCostMode`, `createdAt`, `updatedAt`.
- Must never store: API keys, Gemini keys, Firebase service account keys, raw file contents.
- Relation: owns both Learner Memory and Academic Knowledge branches without mixing them.
- MVP status: planned.

## `users/{userId}/workspaces/{workspaceId}`

- Purpose: stable workspace identity and hierarchy metadata.
- Key fields: `name`, `description`, `path`, `parentWorkspaceId`, `createdAt`, `updatedAt`, `status`.
- Must never store: learner observations as academic content, provider secrets, raw file bytes.
- Relation: default scope for sessions, files, summaries, memory writes, and academic knowledge metadata.
- MVP status: planned.

## `users/{userId}/uploadedFiles/{fileId}`

- Purpose: metadata for app-managed files.
- Key fields: `workspaceId`, `name`, `storagePath`, `mimeType`, `sizeBytes`, `assignmentStatus`, `indexingStatus`, `indexProvider`, `createdAt`, `updatedAt`.
- Must never store: full PDF/DOCX content, API keys, durable learner memory.
- Relation: source metadata for Academic Knowledge, not Learner Memory.
- MVP status: planned.

## `users/{userId}/sessions/{sessionId}`

- Purpose: tutor session metadata and message references.
- Key fields: `workspaceId`, `workMode`, `costMode`, `startedAt`, `updatedAt`, `messageCount`, `activeFileIds`.
- Must never store: provider secrets, unvalidated model internals, whole knowledge base dumps.
- Relation: may produce learner memory candidates and academic summaries, stored separately.
- MVP status: planned.

## `users/{userId}/sessionSummaries/{summaryId}`

- Purpose: rolling summaries for retrieval and continuity.
- Key fields: `sessionId`, `workspaceId`, `summary`, `rollingVersion`, `sourceMessageRange`, `createdAt`.
- Must never store: private keys, raw provider responses, unrelated learner preferences.
- Relation: can become Academic Knowledge metadata if it summarizes course content; does not become Learner Memory by default.
- MVP status: planned.

## `users/{userId}/learnerMemory/{memoryId}`

- Purpose: durable information about how Nevo learns.
- Key fields: `content`, `type`, `status`, `confidence`, `sourceSessionId`, `sourceMessageId`, `createdAt`, `updatedAt`.
- Must never store: academic source text as memory, PDF chunks, provider secrets.
- Relation: strictly Learner Memory only.
- MVP status: planned.

## `users/{userId}/academicKnowledge/{knowledgeId}`

- Purpose: metadata for course materials, source summaries, concepts, and retrievable academic content.
- Key fields: `workspaceId`, `sourceFileId`, `title`, `contentType`, `summary`, `citationLabel`, `pageRange`, `sourceIds`, `createdAt`.
- Must never store: learner pacing preferences, personal learning weaknesses, provider secrets.
- Relation: strictly Academic Knowledge only.
- MVP status: planned.

## `users/{userId}/decisionLog/{entryId}`

- Purpose: hidden technical log in English.
- Key fields: `decisionType`, `title`, `decision`, `rationale`, `workspaceId`, `sessionId`, `costMode`, `retrievalScope`, `createdAt`.
- Must never store: API keys, raw private keys, public UI copy as a substitute for explanation.
- Relation: records decisions about both memory and knowledge without becoming either.
- MVP status: planned.

## `users/{userId}/providerSettings/{providerId}`

- Purpose: provider name, type, status, and non-secret configuration metadata.
- Key fields: `providerName`, `providerType`, `status`, `enabled`, `lastCheckedAt`, `notes`.
- Must never store: API keys, OAuth secrets, service account private keys, raw credentials.
- Relation: supports model/retrieval/web-search operation but is not Learner Memory or Academic Knowledge.
- MVP status: planned.
