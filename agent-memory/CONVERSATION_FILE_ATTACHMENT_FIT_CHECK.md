# Conversation File Attachment Fit Check

## 1. Brain files read
- `AGENTS.md`
- `agent-memory/PROJECT_BRAIN/00_CURRENT_STATE.md`
- `agent-memory/PROJECT_BRAIN/01_SYSTEM_PIPELINE_CONTRACTS.md`
- `agent-memory/PROJECT_BRAIN/02_CHANGE_IMPACT_MATRIX.md`
- `agent-memory/PROJECT_BRAIN/03_RISK_REGISTER.md`
- `agent-memory/PROJECT_BRAIN/04_AGENT_PREFLIGHT_PROTOCOL.md`
- `agent-memory/PROJECT_BRAIN/05_REGRESSION_SMOKE_PLAYBOOK.md`

## 2. Graphify queries run
- `graphify query "TutorConversation onFileSelected upload composer message send"`
- `graphify query "sendSessionMessage session message request file context"`
- `graphify query "SessionRecord primaryFileId attachedFileIds"`
- `graphify query "message attachments uploaded file id"`
- `graphify query "workspaceFilesApiClient upload file route"`
- `graphify query "fileChunkRetrievalService workspace uploaded files retrieval"`
- `graphify query "sessionMessageApiService file inventory retrieval grounding"`
- `graphify query "uploaded file context current conversation"`

## 3. Impact prediction
- A real upload-with-message feature will cross client composer state, message API request shape, message persistence, retrieval prioritization, and tutor file-awareness wording.
- It can regress the current workspace-wide upload flow if the new composer path reuses `handleFileSelected()` without separating "stage locally" from "upload now".
- It must preserve the existing soft-delete boundary by continuing to source tutor/retrieval visibility through `listUploadedFiles(...)` and `getUploadedFile(...)`.
- It should not touch Deep PDF orchestration, extraction/chunking semantics, or workspace/course delete.

## 4. Current upload flow
- `TutorConversation` calls `onFileSelected(file)` immediately from the composer plus-menu.
- `page.tsx` `handleFileSelected()` validates the file, uploads bytes to storage right away, creates uploaded-file metadata through `createWorkspaceFileMetadata(...)`, reloads workspace files, then starts extraction/chunking/embeddings.
- Result: the file becomes part of workspace/course study materials immediately, before the user sends any message.

## 5. Current message send flow
- `TutorConversation` sends messages through `sendSessionMessage(token, { workspaceId, sessionId, userMessage, workMode, costMode })`.
- `sessionMessagesApiTypes.ts` and `sessionMessageApiSchemas.ts` only support:
  - `workspaceId`
  - `userMessage`
  - `workMode`
  - `costMode`
- `/api/sessions/[sessionId]/messages` accepts JSON only.
- `messageRepository.appendMessage(...)` persists message content/citations/status/tool fields only. No attachment field exists.

## 6. Current retrieval/file context flow
- `sessionMessageApiService` classifies the request, then uses workspace-wide file state.
- Deterministic file access/inventory uses `listUploadedFiles(userId, workspaceId)`.
- Semantic retrieval uses `retrieveRelevantFileChunks({ userId, workspaceId, query, ... })`.
- `fileChunkRetrievalService` starts from all eligible uploaded files in the workspace. It has no sessionId, no message attachment inputs, and no file-priority hint.
- Current meaning: the tutor can know "files in this workspace", not "the file attached to this message/conversation".

## 7. Missing data model pieces
- No message attachment model.
- No `SessionRecord.primaryFileId`.
- No `SessionRecord.attachedFileIds`.
- No session-file-context collection.
- No persisted relation between a specific uploaded file and a specific message.
- No retrieval input for "prioritize these file IDs for this turn".

## 8. Option comparison

### Option A — Message attachments only
- Add `attachedFileIds` to user messages.
- Retrieval prioritizes those files for the current turn.
- Conversation context can be derived from the most recent user message that has attachments.
- Pros:
  - Smallest schema change.
  - Matches the user mental model of "I attached this file to this message."
  - Avoids modifying `SessionRecord` in the first batch.
- Cons:
  - "Current conversation file" becomes implicit unless later promoted into explicit session state.
  - Sidebar/session-level file context is harder to show cheaply.

### Option B — Session primary file only
- Add `primaryFileId` to `SessionRecord`.
- Composer send updates the session primary file.
- Pros:
  - Clean default context for follow-up turns.
  - Retrieval prioritization is straightforward.
- Cons:
  - Does not model which message carried which file.
  - Does not really match ChatGPT/Gemini attachment semantics.
  - Multi-file turns become awkward immediately.

### Option C — Both message attachments and session primary file
- Add `message.attachedFileIds`.
- Add `session.primaryFileId` (and maybe later `session.attachedFileIds`).
- Pros:
  - Best product fit.
  - Exact per-turn attachment semantics plus stable default session context.
  - Easier future UX for "this lesson is about this file".
- Cons:
  - Wider data-model and migration surface.
  - More consistency rules to define up front.

## 9. Recommended MVP model
- Recommended MVP: **Option A first, with derived session context**, not full Option C immediately.
- Concretely:
  - Add `attachedFileIds?: string[]` to persisted user messages.
  - On send, upload staged files first, create workspace uploaded-file records, then send the message with those file IDs.
  - For the current turn, retrieval should prioritize `attachedFileIds`.
  - For follow-up turns with no new attachment, derive the active conversation file context from the most recent user message that had `attachedFileIds`.
- Why this is the safest MVP:
  - It gives real message-level meaning, not fake UI chips.
  - It satisfies "the tutor should know this is the file attached to this conversation/message" without forcing a `SessionRecord` schema change in the first batch.
  - It preserves workspace knowledge-base behavior because the file is still created as a normal uploaded file.
- Defer explicit `session.primaryFileId` until we prove we need stronger persistent session-level file state.

## 10. Exact files that would need changes
- `src/types/index.ts`
- `src/server/workspaces/workspaceTypes.ts`
- `src/lib/sessions/sessionMessagesApiTypes.ts`
- `src/server/workspaces/sessionMessageApiSchemas.ts`
- `src/server/workspaces/messageRepository.ts`
- `src/server/workspaces/sessionMessageApiService.ts`
- `src/server/workspaces/fileChunkRetrievalService.ts`
- `src/app/api/sessions/[sessionId]/messages/route.ts`
- `src/app/page.tsx`
- `src/components/tutor/TutorConversation.tsx`
- `src/lib/workspaces/workspaceFilesApiClient.ts`
- tests for message schemas, message repository, session message service, retrieval prioritization, and composer behavior

## 11. Proposed implementation batches

### C1 — data model + schema
- Add `attachedFileIds?: string[]` to message types/records.
- Extend client/server message request schemas to carry attachment file IDs.
- Keep session schema unchanged in C1.

### C2 — composer attachment chips / staged upload UX
- Add local staged attachment state to the composer.
- Show removable chips before send.
- Do not upload on file selection anymore for this path.
- Keep existing file-panel upload path unchanged.

### C3 — upload-with-message pipeline
- On send:
  - upload staged files to storage
  - create workspace file metadata
  - send message with created `attachedFileIds`
  - start normal processing pipeline
- If upload fails, do not silently send a misleading "attached" message.

### C4 — retrieval/session context prioritization
- Extend retrieval execution to prioritize current-turn `attachedFileIds`.
- If no current-turn attachments exist, derive active file context from the latest prior user message with `attachedFileIds`.
- Keep workspace-wide retrieval fallback when no conversation-specific context exists.

### C5 — tutor wording / inventory update
- Update deterministic file-awareness wording so the tutor can distinguish:
  - file attached to this message/conversation
  - files available in the wider workspace
- Keep raw IDs hidden.

### C6 — tests / smoke
- Schema and repository tests for attachment persistence.
- Composer tests for staged chips and send path.
- Session message service tests for prioritized retrieval.
- Smoke: upload with message, follow-up question against same file, file still appears in study materials, workspace upload path still works.

## 12. Risks/open decisions
- The current POST `/messages` route is JSON-only, so upload-with-message is likely a two-step client action wrapped into one send flow, not a single multipart endpoint in the first batch.
- Need a product decision on failure handling:
  - block the message if attachment upload fails
  - or allow "send without file" only after explicit user confirmation
- Need a product decision on attachment replacement semantics:
  - does a later attached message replace the active file context
  - or can multiple recent attachments remain active
- Retrieval prioritization must still pass through normal uploaded-file ownership and deletion filters.

## 13. What must not be implemented yet
- Fake attachment chips with no persisted backend meaning.
- `primaryFileId` on session before the message-attachment path is real.
- `attachedFileIds` on session in the MVP batch.
- Retrieval hacks that bypass uploaded-file repository filters.
- Any change to Deep PDF, extraction, chunking, embeddings, or Firebase workspace delete semantics.

## 14. Ready for implementation C1
- **YES**
- Recommended first build step: add message-level attachment schema only, then wire staged composer UX on top of that.

## 15. Validation results
- `npx tsc --noEmit` — passed
- `npx vitest run` — passed
- `npm run build` — passed
- `git diff --check` — passed
- `graphify update .` — passed

## 16. Confirmation
- No app code changed in this fit check.
- No UI files were edited in this fit check.
- No backend behavior changed.
- No retrieval behavior changed.
- No Deep PDF behavior changed.
- No Firebase data model changed.
- No `git add`, commit, push, or pull was run.
