# Attachment Failure Diagnostic Report

**Date:** 2026-06-03
**Branch:** repair/workspace-cleanup-fit-check
**HEAD:** 1b900d8 docs: add working tree consolidation execution report
**Working tree:** 3 modified (C2/C3 uncommitted), 2 untracked

---

## Manual failure summary

Nevo attached a file via the composer chip, sent a question, tutor did not answer from the attached file. The question is whether this is C4 missing, a C2/C3 bug, or both plus a processing race.

---

## Chain verification

| Step | Expected | Evidence | Status |
|---|---|---|---|
| File staged without upload | File selection creates `StagedAttachment` in state, no storage call | `handleStageAttachment` appends to `stagedAttachments`; `onUploadAttachmentFile` NOT called on selection | **PASS** |
| Upload on send | `handleSubmit` uploads all staged files before `sendSessionMessage` | `for...of stagedAttachments` → `onUploadAttachmentFile(att.file)` → `handleAttachmentUpload` | **PASS** |
| fileId returned | `handleAttachmentUpload` returns `createdFile.id` as `string` | `page.tsx:455 return createdFile.id` | **PASS** |
| `attachedFileIds` sent in request | Client includes them in POST body | `sessionMessagesApiClient.ts:51 attachedFileIds: input.attachedFileIds` | **PASS** |
| Backend schema accepts | Schema parses and validates field | `sessionMessageApiSchemas.ts` parses, max 10 IDs, non-empty strings | **PASS** |
| Service validates file ownership | `validateAttachedFileIds` checks file exists and belongs to workspace | `sessionMessageApiService.ts:487–513` — `getUploadedFile` + `workspaceId` check | **PASS** |
| Service validates file is processed | Validation rejects unprocessed files | `validateAttachedFileIds` does NOT check `extractionStatus` or `chunkingStatus` — passes for any uploaded file | **GAP** (not a bug — C4 design decision) |
| Message persists `attachedFileIds` | Firestore `MessageRecord` stores the IDs | `messageRepository.ts:64 attachedFileIds: input.attachedFileIds` | **PASS** |
| Retrieval receives `attachedFileIds` | `executeRetrievalForTutorResponse` receives and uses attached file IDs | Signature at line 539 has no `attachedFileIds` param; `retrieveFileChunks` call has no `attachedFileIds` | **FAIL — C4 missing** |
| Retrieval prioritizes attached file | Chunk scoring boosts or filters chunks from `attachedFileIds` first | `fileChunkRetrievalService.FileChunkRetrievalInput` has no `attachedFileIds` field | **FAIL — C4 missing** |
| File ready before retrieval | Attached file's extraction/chunking complete when question is sent | `handleAttachmentUpload` uses `void runFileProcessingPipeline(...)` (fire-and-forget); returns `createdFile.id` before pipeline completes | **RACE CONDITION** |
| Tutor wording honest for content Q | When attached file is not ready, tutor says so | Deterministic `file_access_status` handler handles "can you see the file?" but NOT general content questions — no "your attached file is still preparing" path for content queries | **GAP** |

---

## Root cause classification

### 1. C4 retrieval prioritization missing — CONFIRMED PRIMARY CAUSE

`input.attachedFileIds` is validated and persisted (C1 ✅), but is **never forwarded** to the retrieval layer:

- `executeRetrievalForTutorResponse(repositories, userId, workspaceId, userMessage, workMode, tutorResponse, decision, costMode)` — no `attachedFileIds` parameter
- `repositories.retrieveFileChunks({ userId, workspaceId, query, maxChunks, maxTokens })` — no `attachedFileIds`
- `FileChunkRetrievalInput` type has no `attachedFileIds` field
- Retrieval is fully workspace-wide; it has no knowledge of which file was attached to this turn

**This is the expected C4 gap, intentionally deferred from C2/C3.**

### 2. Processing readiness race — CONFIRMED SECONDARY CAUSE

`handleAttachmentUpload` in `page.tsx`:
```
void runFileProcessingPipeline({ workspaceId, fileId, token, fileBytes }); // fire-and-forget
return createdFile.id; // returned immediately
```

`sendSessionMessage` is called immediately after. The full pipeline (extraction → chunking → embeddings) for a real PDF typically takes 20–120 seconds. The message send + backend round-trip takes 2–30 seconds.

**High probability**: when the first question is asked, the attached file has `extractionStatus: "not_started"` or `"pending"`.

`fileChunkRetrievalService.ts:85–90` filters eligible files:
```typescript
const eligible = files.filter(
  (f) =>
    f.extractionStatus === "completed" &&
    f.chunkingStatus === "completed" &&
    (f.chunkCount ?? 0) > 0
);
```

The newly attached file is **invisible to retrieval** until the full pipeline completes. Even if C4 is implemented (prioritized retrieval by attached file IDs), the file would not be in the eligible set.

### 3. No "attached file is preparing" tutor wording — CONFIRMED TERTIARY GAP

The deterministic `file_access_status` handler (line 205) correctly says "הקובץ עדיין בעיבוד" — but it only fires when the user explicitly asks "can you see the file?". For a content question ("explain this concept"), the service goes straight to the LLM path with retrieval. If the attached file is not ready, retrieval returns results from OTHER workspace files (or nothing), and the tutor answers without any indication that the attached file was seen or is being prepared.

### 4. C2/C3 implementation bug — NOT PRESENT

The chain from composer chip → upload on send → `attachedFileIds` in request → persisted in Firestore is correct. No C2/C3 bug.

---

## What C4 must fix

### A — Retrieval prioritization

1. Add `attachedFileIds?: string[]` to `FileChunkRetrievalInput` type
2. In `retrieveRelevantFileChunks`: when `attachedFileIds` present and non-empty, try to retrieve from those files first (semantic/keyword within attached files), then fall back to workspace-wide if insufficient chunks found
3. Pass `attachedFileIds` down the chain: `input.attachedFileIds` → `executeRetrievalForTutorResponse` → `repositories.retrieveFileChunks`
4. Carry attached file context through conversation: also check prior `MessageRecord`s for `attachedFileIds` when current turn has none

### B — Processing readiness gate in retrieval path

When `attachedFileIds` is present but the attached file is not yet eligible (`extractionStatus !== 'completed'`):

- Do NOT silently retrieve from other workspace files as if the attachment didn't exist
- Return an honest "attached file is still being prepared" response to the user
- Fall back to workspace-wide retrieval only if explicitly appropriate (e.g. follow-up questions in a later turn)

Implementation location: `executeRetrievalForTutorResponse` — before calling `retrieveFileChunks`, check the status of each `attachedFileId` via `repositories.getUploadedFile`. If any are not yet processed, short-circuit with a deterministic response.

### C — Tutor wording for attached-file-processing state

When the readiness gate fires:
- Hebrew: `"הקובץ שצירפת עדיין בעיבוד — חילוץ טקסט, יצירת צ'אנקים, או יצירת embeddings. המתן כמה שניות ונסה שוב עם אותה שאלה."`
- This must be a deterministic return (not LLM-generated), similar to the existing `file_access_status` handler pattern

---

## What C4 must NOT pretend to fix

- C4 cannot fix the race if the file is simply not yet processed. The readiness gate is the fix.
- C4 does not need to block the send (bad UX). The gate at retrieval time handles it gracefully.
- C4 does not need to change the upload pipeline timing — the fire-and-forget pattern is correct for workspace materials; the readiness gate is the right response.
- C4 must NOT bypass the soft-delete and ownership checks already in `validateAttachedFileIds`.
- C4 must NOT change the `validateAttachedFileIds` to require processing completion — that would cause an unrecoverable error (user uploaded, sent, backend rejected). The check must be at retrieval time, not validation time.

---

## Extra required behavior if file is not processed yet

**Recommended: allow send, honest deterministic response at retrieval time.**

Do NOT block send. The file is validly attached and will be processed soon. Blocking send requires waiting up to 2 minutes — unacceptable UX.

Instead:

1. `sendSessionMessage` succeeds — message is persisted with `attachedFileIds`
2. Server-side, before retrieval: check each attached file's `extractionStatus`
3. If ANY attached file is not ready (`extractionStatus !== 'completed'` OR `chunkingStatus !== 'completed'`):
   - Return deterministic response: "הקובץ שצירפת עדיין בעיבוד. המתן כמה שניות ושאל שוב."
   - Do NOT fall back silently to workspace-wide retrieval for this turn
4. User sees the honest message, waits for the FilePanel to show "Ready for learning" status, then re-asks

This is better than:
- Blocking send (too slow)
- Silently answering from workspace (misleading)
- Ignoring the attachment entirely (current broken state)

---

## Recommended next batch

**C4 — Retrieval prioritization + processing readiness gate + honest tutor wording**

Implement together as one cohesive batch:
1. `FileChunkRetrievalInput` add `attachedFileIds?: string[]`
2. `retrieveRelevantFileChunks`: prioritized retrieval for attached file IDs (filter-first + fallback)
3. `executeRetrievalForTutorResponse`: receive `attachedFileIds`, check readiness before retrieval
4. Deterministic "file still preparing" response when attached file not ready
5. Carry `attachedFileIds` context from prior messages for follow-up turns (derive from message history)
6. Tests: retrieval prioritization, readiness gate, workspace fallback, multi-file turn

Do NOT split the readiness gate from C4 retrieval. They are one feature.

---

## Validation

- `npx tsc --noEmit --skipLibCheck`: **PASSED** (exit 0)
- `npx vitest run`: **1043 passed / 0 failed** (78 test files, 18 skipped)
- `git diff --check`: **PASSED**
- `graphify update .`: **PASSED** — 5206 nodes, 6929 edges

---

## Safety

- I did not change code.
- I did not implement fixes.
- I did not run git add.
- I did not commit.
- I did not push.
- I did not run git pull.
