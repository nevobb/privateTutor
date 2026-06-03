# Conversation File Attachment C2/C3 — Composer Upload Wire Report

**Date:** 2026-06-03
**Branch:** repair/workspace-cleanup-fit-check
**Implementor:** Claude

---

## 1. Brain files read

- `AGENTS.md`
- `agent-memory/PROJECT_BRAIN/00_CURRENT_STATE.md`
- `agent-memory/PROJECT_BRAIN/01_SYSTEM_PIPELINE_CONTRACTS.md`
- `agent-memory/PROJECT_BRAIN/02_CHANGE_IMPACT_MATRIX.md`
- `agent-memory/PROJECT_BRAIN/03_RISK_REGISTER.md`
- `agent-memory/PROJECT_BRAIN/04_AGENT_PREFLIGHT_PROTOCOL.md`
- `agent-memory/PROJECT_BRAIN/05_REGRESSION_SMOKE_PLAYBOOK.md`
- `agent-memory/CONVERSATION_FILE_ATTACHMENT_FIT_CHECK.md`
- `agent-memory/WORKING_TREE_CONSOLIDATION_AUDIT.md`
- `agent-memory/WORKING_TREE_CONSOLIDATION_EXECUTION_REPORT.md`

## 2. Graphify queries run

- `TutorConversation plus menu upload file onFileSelected`
- `TutorConversation sendSessionMessage attachedFileIds`
- `page.tsx handleFileSelected uploadLearningFileToStorage create metadata`
- `workspaceFilesApiClient create uploaded file metadata`
- `ChatUploadCard upload card attachment status`
- `message attachedFileIds C1 backend`

## 3. Impact prediction

| Risk area | Assessment | Mitigation |
|---|---|---|
| FilePanel upload | Uses `onFileSelected` from page.tsx directly (line 680), never through TutorConversation — unaffected | Separate prop added; existing callback unchanged |
| `handleUploadWithFeedback` path | Only used when `onUploadAttachmentFile` is absent; composer now prefers staging path | Fallback preserved in PlusMenu prop expression |
| `handleSubmit` deps | `stagedAttachments` and `onUploadAttachmentFile` added to dependency array | Both included; array correct |
| Upload errors blocking send | If any staged file upload throws, `sendSessionMessage` never called | Sequential `for...of` loop; first throw exits before send |
| Staged chips on error | Must survive errors — chips are user's recovery path | `setStagedAttachments([])` only called in success branch |
| Timeout recovery path | Staged chips cleared only when message confirmed delivered | Added `setStagedAttachments([])` inside `recovered` branch |
| `handleAttachmentUpload` vs `handleFileSelected` | Different signatures — `handleAttachmentUpload` returns `Promise<string>` (fileId) | Completely separate callbacks; no shared mutation |
| Soft delete boundary | Upload still goes through `createWorkspaceFileMetadata` → existing `listUploadedFiles` filter applies | Not changed |

## 4. Current upload/send flow before this batch

- `TutorConversation.onFileSelected` → `handleUploadWithFeedback` → `onFileSelected(file)` (immediate upload in page.tsx) → `ChatUploadFeedback` card shown
- `handleSubmit` sent message with no `attachedFileIds`; the C1 backend fields existed but were never populated from the composer
- FilePanel used the same `handleFileSelected` callback directly

## 5. Implemented staged attachment behavior (C2)

**New prop:** `onUploadAttachmentFile?: (file: File) => Promise<string>` on `TutorConversationProps`.

When `onUploadAttachmentFile` is present, the PlusMenu upload action calls `handleStageAttachment(file)` instead of `handleUploadWithFeedback`:
- Creates a `StagedAttachment { localId, file }` and appends to `stagedAttachments` state
- Does NOT upload immediately
- Enforces `MAX_STAGED_ATTACHMENTS = 10` (matches backend schema limit) — shows Hebrew notice if exceeded

**Chip UI:** A row of `StagedAttachmentChip` components renders inside the textarea wrapper when `stagedAttachments.length > 0` (`data-testid="staged-attachments"`). Each chip shows:
- Paperclip icon + truncated file name (title attribute for full name on hover)
- Remove button (`data-testid="staged-attachment-remove"`, `aria-label="Remove <filename>"`)

Removing a chip calls `handleRemoveStagedAttachment(localId)` which filters it from state.

## 6. Upload-on-send behavior (C3)

Inside `handleSubmit`, after token acquisition, before `sendSessionMessage`:

```
if (stagedAttachments.length > 0 && onUploadAttachmentFile) {
  const ids: string[] = [];
  for (const att of stagedAttachments) {
    const fileId = await onUploadAttachmentFile(att.file);
    ids.push(fileId);
  }
  attachedFileIds = ids;
}
```

`sendSessionMessage` is then called with `attachedFileIds` in the request body. The C1 backend validates, persists, and echoes these IDs in the saved `MessageRecord`.

**`handleAttachmentUpload` in page.tsx** (new callback returning `string`):
1. Validates user/workspace auth state — throws on missing
2. `validateLearningFile(file)` — throws on invalid type/size
3. `uploadLearningFileToStorage` — throws on storage error
4. `getToken` — throws if token unavailable
5. `createWorkspaceFileMetadata` — throws on API error
6. Starts `runFileProcessingPipeline` (async, non-blocking)
7. Returns `createdFile.id`

This is functionally equivalent to `handleFileSelected` but returns the file ID instead of `void`, and does not set `fileUploadStatus` (that panel-level state is irrelevant for composer attachment flow).

## 7. Failure behavior

- **Upload fails (any staged file):** the `for...of` loop throws, jumping to the outer catch. `sendSessionMessage` is never called. `stagedAttachments` state is NOT cleared — chips remain visible. `composerNotice` shows send failure message plus the error detail if the error came from the attachment upload.
- **Send fails after upload succeeds:** chips remain visible. The file IS in the workspace (upload succeeded), so the chips are still meaningful — user can re-send or remove and re-stage.
- **Timeout recovery after upload+send:** if timeout recovery finds a new assistant message, `setStagedAttachments([])` clears chips (message delivered). If recovery fails, chips remain.
- No silent failure path: the message is only considered delivered when `sendSessionMessage` returns a successful result.

## 8. Existing workspace upload preservation

- `FilePanel` receives `onFileSelected={handleFileSelected}` from page.tsx (line 680) — unchanged
- `TutorConversation`'s `onFileSelected` prop is still passed from page.tsx (line 766) — used as the `handleUploadWithFeedback` fallback in PlusMenu when `onUploadAttachmentFile` is absent
- `handleFileSelected` in page.tsx is unchanged (still returns `Promise<void>`, sets `fileUploadStatus`, starts pipeline)
- The `ChatUploadCard` feedback mechanism remains intact for any fallback path
- `runFileProcessingPipeline` shared between both upload paths — unchanged

## 9. Files changed

| File | Type of change |
|---|---|
| `src/components/tutor/TutorConversation.tsx` | Added `StagedAttachment` type, pure helpers, `onUploadAttachmentFile` prop, `stagedAttachments` state, staging handlers, chip UI, `StagedAttachmentChip` component, updated `handleSubmit`, updated PlusMenu prop |
| `src/app/page.tsx` | Added `handleAttachmentUpload` callback, added `onUploadAttachmentFile` prop on `TutorConversation` |
| `tests/components/tutor/TutorConversation.test.tsx` | Added imports, added C2/C3 test sections |

## 10. Tests added/updated

New test sections in `tests/components/tutor/TutorConversation.test.tsx`:

- **`buildStagedAttachment`** (3 tests): builds with file, uses provided localId, generates distinct IDs
- **`removeStagedAttachment`** (3 tests): removes matching, handles missing id, handles empty list
- **`canAddMoreAttachments`** (3 tests): below limit, at limit, constant matches backend 10
- **`StagedAttachmentChip`** (4 tests): renders file name, shows remove button, no remove button without callback, title attribute
- **`TutorConversation staged attachment prop wiring`** (3 tests): renders with `onUploadAttachmentFile`, upload file active in PlusMenu, upload file disabled without callback

Total: 57 tests in TutorConversation.test.tsx (was 38, +19 new).

**Full suite result:** 1043 passed / 0 failed / 122 skipped.

Behavioral tests requiring interactive state (staging on file select, upload called before send, upload failure blocks send, chips survive error) cannot be covered with `renderToStaticMarkup`. They are covered by the pure helper tests and require a full `@testing-library/react` + jsdom setup or an emulator integration test. This is documented as a gap for the next test infrastructure batch.

## 11. Validation results

- `npx tsc --noEmit --skipLibCheck`: **PASSED** (exit 0)
- `npx vitest run`: **1043 passed / 0 failed** (78 test files passed, 18 skipped)
- `git diff --check`: **PASSED** (no whitespace errors)
- `graphify update .`: **PASSED** — 5206 nodes, 6929 edges, 333 communities

## 12. Manual smoke checklist

1. Select a file in composer plus menu → chip appears, no upload starts immediately (no processing spinner in FilePanel)
2. Remove chip → it disappears
3. Add same file again → second chip appears (no crash)
4. Type a message, send → file uploads (appears in Study Materials), user message sent with chip cleared
5. Open Firestore and confirm persisted user message has `attachedFileIds: ["<fileId>"]`
6. Kill network mid-upload → upload error shown in `composerNotice`, chip remains, message NOT sent
7. Send without any chip → normal message, no `attachedFileIds`, existing behavior unchanged
8. Upload from FilePanel (Study Materials) → still works immediately, no chip appears in composer

## 13. Risks / open decisions

| Item | Status |
|---|---|
| Max attachment limit UI feedback | Implemented: Hebrew notice shown, chip not added beyond MAX_STAGED_ATTACHMENTS |
| Duplicate file selection | Allowed by design: two separate File objects each get their own localId. Backend deduplication is a future concern. |
| `handleAttachmentUpload` not setting `fileUploadStatus` | Intentional: that panel-level state is for FilePanel feedback, not composer attachment flow. ChatUploadCard still exists for the fallback path. |
| Interactive/behavioral tests | Gap: no `@testing-library/react` + jsdom setup. Pure logic and static rendering covered. |
| C4 retrieval prioritization | Not implemented in this batch. Backend already receives `attachedFileIds` and persists them; retrieval still uses workspace-wide scope. |
| `handleFileSelected` return type | Still `Promise<void>` — kept for FilePanel path. The new `handleAttachmentUpload` is the separate path returning `string`. |

## 14. Ready for C4 retrieval prioritization

**YES** — `attachedFileIds` is now passed end-to-end from composer chip selection through `sendSessionMessage` to the persisted `MessageRecord`. The `fileChunkRetrievalService` can now receive `attachedFileIds` as a prioritization hint per the C4 spec. The grounding layer changes are separate from this batch.

## 15. Confirmation — unchanged systems

- Tutor reasoning: NOT changed
- Retrieval prioritization: NOT changed (C4 separate batch)
- Deep PDF behavior: NOT changed
- Extraction/chunking semantics: NOT changed
- Soft delete semantics: NOT changed
- `SessionRecord.primaryFileId`: NOT implemented
- Learner memory: NOT changed
- Workspace/course delete: NOT changed

## 16. Safety

- I did not run git add.
- I did not commit.
- I did not push.
- I did not run git pull.
