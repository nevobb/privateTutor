# Conversation File Attachment C1 — Data Model

## 1. Brain files read
- `AGENTS.md`
- `agent-memory/PROJECT_BRAIN/00_CURRENT_STATE.md`
- `agent-memory/PROJECT_BRAIN/01_SYSTEM_PIPELINE_CONTRACTS.md`
- `agent-memory/PROJECT_BRAIN/02_CHANGE_IMPACT_MATRIX.md`
- `agent-memory/PROJECT_BRAIN/03_RISK_REGISTER.md`
- `agent-memory/PROJECT_BRAIN/04_AGENT_PREFLIGHT_PROTOCOL.md`
- `agent-memory/PROJECT_BRAIN/05_REGRESSION_SMOKE_PLAYBOOK.md`
- `agent-memory/CONVERSATION_FILE_ATTACHMENT_FIT_CHECK.md`

## 2. Graphify queries run
- `graphify query "message repository message record user message"`
- `graphify query "sessionMessagesApiTypes sendSessionMessage request"`
- `graphify query "sessionMessageApiSchemas userMessage workMode costMode"`
- `graphify query "sessionMessageApiService append user message"`
- `graphify query "uploadedFileRepository getUploadedFile isDeleted"`
- `graphify query "message attachments file ids"`

## 3. Impact prediction
- This batch touches the message contract end to end:
  - shared message type
  - session message request type
  - request parsing
  - message persistence
  - message route error handling
  - pre-append validation in `sessionMessageApiService`
- Main regression risks:
  - normal message send without attachments stops working
  - attachment validation happens too late and creates partial messages
  - deleted or foreign files slip through because validation bypasses `uploadedFileRepository`
- Safety proof needed:
  - schema tests for normalization and rejection
  - service tests for pre-append validation failures
  - repository tests for persistence
  - full message-route and full repo validation

## 4. Data model changes
- Added `attachedFileIds?: string[]` to `TutorMessage`.
- Added `attachedFileIds?: string[]` to `AppendMessageInput`.
- User messages can now persist attachment references.
- Assistant messages remain attachment-free by behavior; the field stays optional for compatibility.

## 5. API schema changes
- Added `attachedFileIds?: string[]` to:
  - `SendMessageInput`
  - `PostMessageRequest`
  - `MessageApiResponse`
- `parsePostMessageRequest(...)` now:
  - accepts optional `attachedFileIds`
  - requires an array when present
  - trims values
  - de-duplicates values
  - normalizes `[]` to `undefined`
  - rejects non-strings
  - rejects empty strings
  - rejects more than 5 IDs
- `sessionMessagesApiClient` now includes `attachedFileIds` in the POST payload when present.

## 6. Attachment validation rules
- Validation happens in `sessionMessageApiService` before the first `appendMessage(...)`.
- Each attached file must:
  - exist through `getUploadedFile(userId, fileId)`
  - belong to the authenticated user
  - not be soft-deleted
  - belong to the current workspace
- If validation fails:
  - the request is rejected
  - no user message is persisted
  - the tutor/model is not called
  - the route returns `400` with a safe error message

## 7. Persistence behavior
- `messageRepository.appendMessage(...)` now stores `attachedFileIds` when present.
- `listSessionMessages(...)` safely deserializes old records without the field.
- `serializeMessage(...)` includes `attachedFileIds` in API responses when present.

## 8. What was intentionally not implemented
- No staged upload UI
- No attachment chips
- No upload-with-message pipeline
- No retrieval prioritization
- No tutor wording changes
- No session-level `primaryFileId`
- No session-level `attachedFileIds`
- No Deep PDF changes

## 9. Files changed
- `src/types/index.ts`
- `src/lib/sessions/sessionMessagesApiClient.ts`
- `src/lib/sessions/sessionMessagesApiTypes.ts`
- `src/server/workspaces/workspaceTypes.ts`
- `src/server/workspaces/sessionMessageApiSchemas.ts`
- `src/server/workspaces/messageRepository.ts`
- `src/server/workspaces/sessionMessageApiService.ts`
- `src/app/api/sessions/[sessionId]/messages/route.ts`
- `tests/lib/sessions/sessionMessagesApiClient.test.ts`
- `tests/server/workspaces/sessionMessageApiSchemas.test.ts`
- `tests/server/workspaces/messageRepository.test.ts`
- `tests/server/workspaces/sessionMessageApiRoute.test.ts`
- `tests/server/workspaces/sessionMessageApiService.test.ts`
- `tests/firebase/workspacePersistence.emulator.test.ts`

## 10. Tests added/updated
- Added schema tests for:
  - de-duplication
  - empty-array normalization
  - non-string rejection
  - empty-string rejection
  - max-count rejection
- Added client test proving `attachedFileIds` are sent in the message payload.
- Added repository/emulator tests proving `attachedFileIds` persist on user messages and old tutor messages remain fine.
- Added service tests proving:
  - valid file IDs persist
  - another-workspace file is rejected
  - another-user file is rejected
  - missing/soft-deleted file is rejected
  - no append/model call happens on validation failure
- Added route test proving attachment validation errors return `400`.

## 11. Validation results
- `npx tsc --noEmit` — passed
- `npx vitest run` — passed
- `npm run build` — passed
- `git diff --check` — passed
- `graphify update .` — passed

## 12. Risks / open decisions
- Direct service callers can still pass arbitrary arrays at runtime; the route schema is the main normalization layer, while service validation enforces safety on the resolved file IDs.
- The current design uses `getUploadedFile(...)` per attachment ID. If C2/C3 later add larger staged sends, batching may become worth it, but not yet.
- Conversation-level active file context is still not implemented; this batch only stores the relation safely.

## 13. Ready for C2
- **YES**
- Recommended next batch: staged composer attachments + send-time upload flow on top of this stored message relation.

## 14. Confirmation
- Tutor reasoning was not changed.
- Retrieval logic was not changed.
- Deep PDF behavior was not changed.
- Upload/extract/chunk backend behavior was not changed.
- Soft delete semantics were not changed.
- No `git add`, commit, push, or pull was run.
