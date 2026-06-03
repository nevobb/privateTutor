# Course Knowledge Context Picker — C5B/C5C Implementation Report

**Date:** 2026-06-03
**Branch:** repair/workspace-cleanup-fit-check

---

## 1. Brain files read

- `AGENTS.md`
- `agent-memory/PROJECT_BRAIN/00_CURRENT_STATE.md`
- `agent-memory/PROJECT_BRAIN/01_SYSTEM_PIPELINE_CONTRACTS.md`
- `agent-memory/PROJECT_BRAIN/02_CHANGE_IMPACT_MATRIX.md`
- `agent-memory/PROJECT_BRAIN/03_RISK_REGISTER.md`
- `agent-memory/PROJECT_BRAIN/04_AGENT_PREFLIGHT_PROTOCOL.md`
- `agent-memory/PROJECT_BRAIN/05_REGRESSION_SMOKE_PLAYBOOK.md`
- `agent-memory/COURSE_KNOWLEDGE_CONTEXT_PICKER_FIT_CHECK.md`
- `agent-memory/CONVERSATION_FILE_ATTACHMENT_C4_RETRIEVAL_READINESS_REPORT.md`

## 2. Graphify queries run

- `FilePanel isReadyForLearning uploaded files`
- `TutorConversation stagedAttachments attachedFileIds chips`
- `page.tsx uploadedFiles FilePanel TutorConversation props`
- `plus menu upload file composer context`
- `sendSessionMessage attachedFileIds active context`
- `C4 retrieval prioritizedFileIds attachedFileIds`

## 3. Impact prediction

| Risk area | Assessment | Mitigation |
|---|---|---|
| Plus menu upload behavior | Reverted to study-materials-only upload (no chip staged) | `onUploadFile={onFileSelected ? handleUploadWithFeedback : undefined}` restored |
| FilePanel existing upload/delete/continue | Completely unaffected — `onUseInChat` is additive | New prop is optional; no existing prop changed |
| Message send with no context | Works exactly as before — `contextFiles = []` → `attachedFileIds = undefined` | Tested explicitly |
| `handleSubmit` deps | Simplified — removed async upload deps, added `contextFiles`, `onClearStagedContext` | Array updated correctly |
| C4 readiness gate and retrieval | Unchanged — still fires on `attachedFileIds`; `deriveActiveAttachedFileIds` still works | No backend changes |
| `StagedAttachmentChip` display | Uses `att.fileName` (was `att.file.name`) — same result for user, no render change | Tested in chip tests |

## 4. Old behavior before change (C2/C3)

- Plus menu file selection staged a raw `File` object in TutorConversation internal state
- On message send, `handleSubmit` uploaded each staged file via `onUploadAttachmentFile(att.file)` → storage → metadata → fire-and-forget pipeline
- The newly uploaded file IDs were sent as `attachedFileIds`
- C4 readiness gate immediately rejected them because the pipeline hadn't finished
- Result: user always saw "file is being processed" on the first question

## 5. New Study Materials → Use in chat flow (C5B/C5C)

```
1. User uploads PDF via FilePanel "העלה PDF או DOCX" or plus menu
   → existing handleFileSelected → storage → metadata → processing pipeline
   → no composer chip; file appears in Study Materials with status

2. FilePanel polls/shows processing status until isReadyForLearning
   (extractionStatus + chunkingStatus + embeddingStatus all "completed")

3. User clicks "השתמש בשיחה" on a ready file in Study Materials
   → handleFileUseInChat(fileId, fileName) called in page.tsx
   → dedup check (same file not added twice)
   → limit check (max 10 files)
   → StagedAttachment { localId, fileId, fileName } added to stagedContextFiles state

4. Chip appears in composer showing fileName (removable)

5. User types a message and sends
   → handleSubmit reads contextFiles.map(f => f.fileId)
   → No upload — file already in workspace
   → sendSessionMessage({ ..., attachedFileIds: [fileId1, ...] })

6. C4 readiness gate passes (file was ready when selected)
   → C4 prioritized retrieval uses attachedFileIds
   → Tutor answers from selected course file(s)

7. Follow-up turns without re-selecting
   → C4 deriveActiveAttachedFileIds finds prior message's attachedFileIds
   → Retrieval continues prioritizing selected file
```

## 6. What was kept from C1/C4

| Component | Status |
|---|---|
| C1: `attachedFileIds` type/schema/repo/client | **Kept unchanged** |
| C1: `validateAttachedFileIds` service check | **Kept unchanged** |
| C4: Readiness gate (`checkAttachedFilesReadiness`) | **Kept unchanged** — safety net for edge cases |
| C4: `deriveActiveAttachedFileIds` | **Kept unchanged** — follow-up turns still work |
| C4: `prioritizedFileIds` in `fileChunkRetrievalService` | **Kept unchanged** — core retrieval behavior |
| Chip concept and `StagedAttachmentChip` UI | **Kept** — repurposed to show `att.fileName` |
| `removeStagedAttachment` pure function | **Kept** — now used in page.tsx |
| `canAddMoreAttachments` pure function | **Kept** — used in page.tsx `handleFileUseInChat` |
| `MAX_STAGED_ATTACHMENTS = 10` | **Kept** — still enforced |

## 7. What was removed / repurposed from C2/C3

| Component | Action |
|---|---|
| `StagedAttachment.file: File` | **Removed** → replaced with `fileId: string; fileName: string` |
| `buildStagedAttachment(file: File)` | **Repurposed** → `buildStagedAttachment({ fileId, fileName })` |
| `TutorConversation.onUploadAttachmentFile` prop | **Removed** |
| `page.tsx.handleAttachmentUpload` callback | **Removed** |
| `handleStageAttachment` in TutorConversation | **Removed** (staging now handled by page.tsx) |
| `handleRemoveStagedAttachment` in TutorConversation | **Removed** (replaced by `onRemoveStagedContext` prop) |
| Upload loop in `handleSubmit` | **Removed** → replaced with simple `contextFiles.map(f => f.fileId)` |
| Internal `stagedAttachments` state in TutorConversation | **Removed** → lifted to `stagedContextFiles` state in page.tsx |
| Plus menu → stage-for-upload path | **Removed** → plus menu reverts to study-materials upload only |
| `handleUploadWithFeedback` | **Kept** — plus menu still uploads to study materials |

## 8. Ready-file rule

**Definition (unchanged from FilePanel existing logic):**

```typescript
isReadyForLearning =
  extractionStatus === "completed" &&
  chunkingStatus === "completed" &&
  embeddingStatus === "completed"
```

All three conditions required. This is stricter than C4's backend readiness gate (which only requires extraction + chunking). The picker only shows "Use in chat" for files where semantic retrieval (embeddings) is also ready.

C4's readiness gate remains as a backend safety net for edge cases (e.g., file deleted between selection and send).

## 9. Files changed

| File | Changes |
|---|---|
| `src/components/tutor/TutorConversation.tsx` | Changed `StagedAttachment` type; changed `buildStagedAttachment`; removed `onUploadAttachmentFile` prop; added `stagedContextFiles`, `onRemoveStagedContext`, `onClearStagedContext` props; removed internal state; simplified `handleSubmit`; removed `handleStageAttachment`/`handleRemoveStagedAttachment`; restored plus menu upload path |
| `src/components/files/FilePanel.tsx` | Added `onUseInChat` prop; added "Use in chat" button on `isReadyForLearning` files |
| `src/app/page.tsx` | Added `stagedContextFiles` state; added `handleFileUseInChat`, `handleRemoveStagedContext`, `handleClearStagedContext`; removed `handleAttachmentUpload`; updated FilePanel + TutorConversation props; imported new helpers from TutorConversation |
| `tests/components/tutor/TutorConversation.test.tsx` | Updated `buildStagedAttachment` tests; updated `makeAtt`; replaced "onUploadAttachmentFile" tests with `stagedContextFiles` prop tests |
| `tests/components/files/FilePanel.test.tsx` | Added 6 "Use in chat" tests |

**No backend changes:**
- `sessionMessageApiService.ts` — unchanged
- `fileChunkRetrievalService.ts` — unchanged
- `sessionMessagesApiClient.ts` — unchanged
- `messageRepository.ts` — unchanged
- `sessionMessageApiSchemas.ts` — unchanged

## 10. Tests added / updated

### TutorConversation.test.tsx (updated):
- `buildStagedAttachment` — 3 tests updated for `{ fileId, fileName }` signature
- `removeStagedAttachment` — `makeAtt` updated (no `file: File`)
- "staged attachment prop wiring" — replaced `onUploadAttachmentFile` test with:
  - Renders chips when `stagedContextFiles` provided (shows `data-testid="staged-attachments"`)
  - Renders without crashing when no context files (no chip area rendered)

### FilePanel.test.tsx (+6 tests):
- Shows "Use in chat" button for ready file when `onUseInChat` provided
- Does not show button when `onUseInChat` not provided
- Does not show button for not-ready file (extraction pending)
- Does not show button when extraction done but embedding not done
- Button present in initial state (no delete confirmation)
- Uses `originalFileName` when available (button present)

**Full suite:** 1065 passed / 0 failed (78 files, 18 skipped).

## 11. Validation results

- `npx tsc --noEmit --skipLibCheck`: **PASSED**
- `npx vitest run --exclude 'tests/evaluation/**'`: **1065 passed / 0 failed**
- `git diff --check`: **PASSED**
- `graphify update .`: **PASSED**

## 12. Manual smoke checklist

1. Upload PDF to Study Materials via FilePanel or plus menu
2. Confirm it is NOT immediately selectable ("Use in chat" button absent while processing)
3. When all three statuses complete ("✓ Ready" shown), click "השתמש בשיחה"
4. Confirm chip appears in composer with file name
5. Click chip's remove button — chip disappears
6. Re-select the file, type a question about its content, send
7. Confirm tutor answers from that file (no "still processing" message)
8. Send follow-up without selecting again — confirm tutor still uses file context
9. Select a second ready file — confirm second chip appears alongside first
10. Confirm sending with two files passes both IDs as context
11. Upload new PDF (plus menu or FilePanel) — confirm NO chip appears automatically; file goes to Study Materials only

## 13. Risks / open decisions

| Item | Status |
|---|---|
| `canAddMoreAttachments` limit in `handleFileUseInChat` | Silently ignores excess files — user won't see feedback if limit hit. Could add a toast in page.tsx in future. |
| Dedup uses `fileId` comparison | Correct — same file cannot be added twice regardless of fileName variation |
| Session change clears staged context? | `stagedContextFiles` state persists while `page.tsx` is mounted; switching sessions doesn't clear chips. Should add `useEffect` to clear on `activeSessionId` change in a follow-up. |
| Plus menu label "Upload file" | Still says "Upload file" — could be relabeled "Add to study materials" in C5D for clarity |
| `handleUploadWithFeedback` still in TutorConversation | Kept — still needed for plus menu study materials upload. Not dead code. |
| C4 readiness gate still fires for edge cases | Expected and correct behavior — if a selected file is somehow deleted before send, the gate provides a safe response |

## 14. Ready for C5D wording / polish

**YES**

The full flow is implemented:
- Study Materials is primary intake
- "Use in chat" on ready files
- Chips in composer
- Send passes `attachedFileIds`
- C4 retrieval prioritizes them
- Follow-up turns inherit context

C5D can add: plus menu label "Add to study materials", session-change chip clear, limit feedback, chip count badge in context strip.

## 15. Safety confirmations

- Deep PDF behavior: NOT changed
- Extraction/chunking behavior: NOT changed
- Upload processing pipeline: NOT changed
- Retrieval backend: NOT changed
- Soft delete semantics: NOT changed
- `SessionRecord.primaryFileId`: NOT implemented
- Learner memory: NOT changed

## 16. No git operations

- Did not run git add
- Did not commit
- Did not push
- Did not run git pull
