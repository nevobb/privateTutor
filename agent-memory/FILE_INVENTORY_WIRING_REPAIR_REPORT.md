# File Inventory Wiring Repair Report

**Branch:** repair/wire-file-inventory  
**Date:** 2026-06-02

---

## 1. Branch

`repair/wire-file-inventory`

---

## 2. Starting Issue

`buildFileInventory()` and `formatFileInventoryResponse()` existed in `src/server/tutor/fileInventoryService.ts` and were fully tested in isolation, but were **never called** from the session message flow.

When a user asked "which questions are in the file?", `sessionMessageApiService` classified the intent as `file_content_inventory` (via `requestClassifier`) but then returned a static Hebrew placeholder string (`INVENTORY_NOT_AVAILABLE_RESPONSE`) regardless of whether real chunk text existed. The tutor could not answer what was in the uploaded file even when extraction and chunking were complete.

---

## 3. Graphify Commands Used

```
graphify query "buildFileInventory sessionMessageApiService file_content_inventory requestClassifier"
graphify update .
```

The first query confirmed no edge existed from `buildFileInventory()` into `sessionMessageApiService.ts` — graph showed `buildFileInventory()` connected only to `fileInventoryService.ts` and `fileInventoryService.test.ts`, not the service.

---

## 4. Files Inspected

- `src/server/tutor/fileInventoryService.ts` — `buildFileInventory()`, `formatFileInventoryResponse()`, `INVENTORY_NOT_AVAILABLE_RESPONSE`
- `src/server/tutor/requestClassifier.ts` — `classifyTutorRequest()` intent types
- `src/server/workspaces/sessionMessageApiService.ts` — `Repositories` interface, `file_content_inventory` handler block
- `src/server/workspaces/fileChunkRepository.ts` — `listFileChunks(userId, workspaceId, fileId)` signature
- `src/server/workspaces/workspaceTypes.ts` — `UploadedFileRecord.originalFileName?: string`
- `tests/server/workspaces/sessionMessageApiService.test.ts` — existing inventory tests

---

## 5. Files Changed

| File | What changed |
|---|---|
| `src/server/workspaces/sessionMessageApiService.ts` | Import + `file_content_inventory` handler block |
| `tests/server/workspaces/sessionMessageApiService.test.ts` | Updated 3 stale assertions, added 2 new tests |

---

## 6. Exact Implementation Summary

### `src/server/workspaces/sessionMessageApiService.ts`

**Import change (line 3):**
```diff
- import { INVENTORY_NOT_AVAILABLE_RESPONSE } from "../tutor/fileInventoryService";
+ import { buildFileInventory, formatFileInventoryResponse } from "../tutor/fileInventoryService";
```

**Handler block replacement (~lines 206–228):**

Old code always returned a static placeholder when a ready file existed:
```typescript
const content = hasReadyFile
  ? INVENTORY_NOT_AVAILABLE_RESPONSE       // ← static placeholder, never scanned chunks
  : "אין קבצים מעובדים זמינים כרגע...";
```

New code has three branches — no files, files not ready, files ready:
```typescript
const readyFile = files.find(
  (f) => f.extractionStatus === "completed" && f.chunkingStatus === "completed"
);

let content: string;
if (readyFile) {
  // Real inventory: load chunks, scan for section headings, format response
  const chunks = await repositories.listFileChunks(userId, input.workspaceId, readyFile.id);
  const inventory = buildFileInventory(readyFile.originalFileName ?? readyFile.name, chunks);
  content = formatFileInventoryResponse(inventory);
} else if (files.length > 0) {
  // Files exist but not yet processed — report their status
  const fileStatuses = files
    .map((f) => {
      const ext = f.extractionStatus ?? "not_started";
      const chk = f.chunkingStatus ?? "not_started";
      return `• ${f.originalFileName ?? f.name}: חילוץ=${ext}, צ׳אנקים=${chk}`;
    })
    .join("\n");
  content = `הקבצים הבאים עדיין בעיבוד — לא ניתן לתת רשימת שאלות עדיין:\n${fileStatuses}\n\nהמתן שהעיבוד יסתיים ונסה שוב.`;
} else {
  // No files at all
  content =
    "לא נמצאו קבצים שהועלו למרחב הלימוד הנוכחי. העלה קובץ PDF או DOCX כדי שאוכל לעבוד עם התוכן.";
}
```

**No changes** to `Repositories` interface or `defaultRepositories()` — `listFileChunks` was already present as a dependency.

### Runtime call path (evidence)

```
User message → classifyTutorRequest() → intent: "file_content_inventory"
  → listUploadedFiles(userId, workspaceId) → find readyFile
  → listFileChunks(userId, workspaceId, readyFile.id) ← NEW CALL
  → buildFileInventory(fileName, chunks)              ← NEW CALL
  → formatFileInventoryResponse(inventory)            ← NEW CALL
  → appendMessage(content)
  → makeDeterministicReturn (no model call)
```

---

## 7. Behavior Now Covered

| User state | Before | After |
|---|---|---|
| No files uploaded | Same generic message | "לא נמצאו קבצים שהועלו..." |
| Files exist but not processed | Generic placeholder | Lists file names with `E:/C:` status, says "still processing" |
| Files ready (extraction+chunking done) | Static placeholder `INVENTORY_NOT_AVAILABLE_RESPONSE` | Real section headings from chunk text via `buildFileInventory()` |
| Files ready, no structured sections found | Static placeholder | Honest "no numbered headings found" + offer to search by topic |

The tutor no longer falsely claims it cannot help when extracted chunks exist.

---

## 8. Tests Added/Updated

### Updated (3 tests — assertions corrected to match new behavior)

1. **"routes 'איזה שאלות יש בקובץ?' to inventory shortcut"** — renamed (removed "chunks NOT scanned"). Changed `expect(repos.listFileChunks).not.toHaveBeenCalled()` → `expect(repos.listFileChunks).toHaveBeenCalledWith("alice", "ws-1", "file-inv")`. The old assertion verified the broken behavior.

2. **"inventory: real sections listed, no refusal, offers to start from a question"** (renamed) — updated match from `/שאלה 3|מילת מפתח|נושא/` (words from the old placeholder) to `/שאלה [12]|נתחיל משאלה/` (words from the actual `formatFileInventoryResponse` output using the test's `questionChunks`).

3. **"when no ready files, inventory returns no-file message"** — updated match from `/אין קבצים|מעובדים/i` to `/לא נמצאו קבצים/i` to match the new no-files message. Added `expect(repos.listFileChunks).not.toHaveBeenCalled()` (correct: chunks should not be fetched if no ready file).

### Added (2 new tests)

4. **"inventory response includes section headings extracted from real chunk text"** — positive proof test. Sends an inventory request with `questionChunks` that have "שאלה 1" and "שאלה 2". Asserts `assistant.content` contains both headings. Confirms `getMockTutorResponse` not called. This is the primary evidence test for the wiring.

5. **"when files exist but not processed, inventory lists them with status"** — covers the new middle branch. Sends an inventory request with a file in `extractionStatus: "pending"`. Asserts model not called, `listFileChunks` not called, response mentions "בעיבוד" and includes the file's `originalFileName`.

---

## 9. Validation Commands and Results

```
npx vitest run tests/server/tutor/fileInventoryService.test.ts
→ 2 test files, 54 tests passed

npx vitest run tests/server/tutor/requestClassifier.test.ts
→ (included above)

npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts
→ 1 test file, 45 tests passed

npx tsc --noEmit
→ Exit 0 (clean)

npx vitest run --exclude 'tests/firebase/**'
→ Test Files: 59 passed | 5 skipped (64)
→ Tests:      561 passed | 16 skipped (577)   [+2 vs baseline]
```

---

## 10. What Was Intentionally Not Fixed

- `pendingFilesByFileId` page-refresh loss — out of scope
- Legacy `executeLegacyIndexedFileRetrieval` still present — out of scope
- Context strip "Sources: not connected yet" — out of scope
- Embedding status not shown in FilePanel — out of scope
- `buildFileInventory` only targets the FIRST ready file — multi-file inventory is a future concern

---

## 11. Remaining Risks

- **Single-file limit**: When multiple ready files exist, only the first one (`files.find(...)`) is inventoried. If the user has multiple files, the inventory only covers one. This is a known simplification — the spec does not yet define multi-file inventory UX.
- **`formatFileInventoryResponse` pattern coverage**: `SECTION_PATTERNS` in `fileInventoryService.ts` covers Hebrew and English numbered formats. Files using paragraph numbers or continuous prose return the "no structured headings" fallback. This is honest behavior, not a bug.
- **Processing-state branch is purely metadata**: The "files still processing" branch reads `extractionStatus`/`chunkingStatus` from Firestore but does not refresh state. If processing just finished between the user's question and the Firestore read, the state is stale by one message cycle. Acceptable for personal use.
- **`originalFileName` fallback to `name`**: `readyFile.originalFileName ?? readyFile.name` — `name` is the storage-path filename which may differ from what the user uploaded. `originalFileName` is the correct display value. Both are on `UploadedFileRecord`.

---

## 12. Confirmation

**No `git add`, `git commit`, or `git push` was run during this task.**

Changes exist only as uncommitted modifications on branch `repair/wire-file-inventory`.
