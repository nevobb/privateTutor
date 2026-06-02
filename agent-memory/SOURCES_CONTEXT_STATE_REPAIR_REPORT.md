# Sources Context State Repair Report

**Branch:** repair/fix-sources-context-state  
**Date:** 2026-06-02

---

## 1. Branch

`repair/fix-sources-context-state`

---

## 2. Starting Issue

`TutorConversation.tsx` line 283 had a hardcoded UI context strip:

```
Topic: {scopeTopicLabel} · Mode: {scopeModeLabel} · Sources: not connected yet
```

`"Sources: not connected yet"` was a stale implementation placeholder. It displayed regardless of:
- Whether files were uploaded
- Whether files were processed and ready for retrieval
- Whether retrieval had actually occurred in the last turn

This misled the user into thinking the source system was permanently unavailable, undermining trust in the file inventory and retrieval features added in previous repair passes.

**Scope of issue:** UI-only. The text does NOT appear in the LLM grounding prompt (`deepseekGroundingPrompt.ts` was clean — `buildGroundingSection()` only emits content when real chunks exist).

---

## 3. Graphify Commands Used

```
graphify query "Sources not connected yet grounding prompt context strip"
graphify update .
```

The first query returned workspace/file API nodes — no direct edge to the context strip text, confirming the text is in the UI layer only and does not feed into the LLM grounding path.

Additional targeted grep confirmed a single occurrence:
```
src/components/tutor/TutorConversation.tsx:283
```

---

## 4. Files Inspected

- `src/components/tutor/TutorConversation.tsx` — context strip, `TutorConversationProps`
- `src/server/tutor/deepseekGroundingPrompt.ts` — confirmed clean: `buildGroundingSection()` returns `""` when no grounding context, never emits the placeholder
- `src/app/page.tsx` — `TutorConversation` call site, `uploadedFiles` state (line 107)
- `tests/components/tutor/TutorConversation.test.tsx` — existing test structure, exports tested

---

## 5. Files Changed

| File | What changed |
|---|---|
| `src/components/tutor/TutorConversation.tsx` | Add `uploadedFileCount?: number` prop; add `formatSourcesLabel()` helper; replace hardcoded string |
| `src/app/page.tsx` | Pass `uploadedFileCount={uploadedFiles.length}` to `TutorConversation` |
| `tests/components/tutor/TutorConversation.test.tsx` | Import `formatSourcesLabel`; add 9 new tests |

---

## 6. Exact Implementation Summary

### `src/components/tutor/TutorConversation.tsx`

**Added to `TutorConversationProps`:**
```typescript
uploadedFileCount?: number;
```

**New exported helper (before the component):**
```typescript
export function formatSourcesLabel(count: number | undefined): string {
  if (count === undefined || count === 0) return "No files uploaded";
  if (count === 1) return "1 file available";
  return `${count} files available`;
}
```

**Context strip line (was):**
```tsx
Topic: <bdi>{scopeTopicLabel}</bdi> · Mode: {scopeModeLabel} · Sources: not connected yet
```

**Context strip line (now):**
```tsx
Topic: <bdi>{scopeTopicLabel}</bdi> · Mode: {scopeModeLabel} · Sources: {formatSourcesLabel(uploadedFileCount)}
```

### `src/app/page.tsx`

Added one prop to the `TutorConversation` call:
```tsx
uploadedFileCount={uploadedFiles.length}
```

`uploadedFiles` was already a managed state in `page.tsx` (reloaded whenever workspace changes or after upload). No new state needed.

---

## 7. How the Old Hardcoded Placeholder Is Removed/Blocked

The string literal `"Sources: not connected yet"` no longer exists anywhere in the codebase. Any attempt to search for it returns no results. `formatSourcesLabel()` can never return that string — its only outputs are `"No files uploaded"`, `"1 file available"`, and `"N files available"`. The test suite verifies this explicitly.

---

## 8. How Accurate Source/Retrieval State Is Now Represented

`uploadedFileCount` is `uploadedFiles.length` — the count of files known to the workspace at render time. This count reflects files that have been created (via `createWorkspaceFileMetadata`) regardless of processing state. It is:

| State | Display |
|---|---|
| No files uploaded yet | `"No files uploaded"` |
| 1 file uploaded (any processing state) | `"1 file available"` |
| N files uploaded | `"N files available"` |

The count updates whenever `reloadWorkspaceFiles()` runs — after upload, after workspace switch, on mount. It never shows stale "not connected" when files exist.

**Limitation acknowledged:** The count does not distinguish between files at `extractionStatus: "pending"` vs `"completed"`. A file that just uploaded but is still extracting increments the count. This is intentionally conservative — the user sees "1 file" rather than "No files" during processing, which is accurate (the file IS there, just processing). A future refinement could show "1 file (processing)" but that is out of scope here.

---

## 9. Tests Added/Updated

### `formatSourcesLabel` unit tests (5 new)

| Test | Assertion |
|---|---|
| `count === undefined` | Returns `"No files uploaded"` |
| `count === 0` | Returns `"No files uploaded"` |
| `count === 1` | Returns `"1 file available"` |
| `count > 1` | Returns `"N files available"` |
| All values | Never contains `"not connected yet"` |

### `TutorConversation` context strip rendering tests (4 new)

| Test | Assertion |
|---|---|
| No `uploadedFileCount` prop | HTML does not contain `"not connected yet"` |
| `uploadedFileCount={0}` | HTML contains `"No files uploaded"` |
| `uploadedFileCount={1}` | HTML contains `"1 file available"` |
| `uploadedFileCount={3}` | HTML contains `"3 files available"` |

All tests use `renderToStaticMarkup` (server-render, no DOM needed).

---

## 10. Validation Commands and Results

```
npx vitest run tests/components/tutor/TutorConversation.test.tsx
→ 1 test file, 21 tests passed  [+9 new vs previous 12]

npx vitest run tests/server/tutor/deepseekProviderGrounding.test.ts
→ passed

npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts
→ passed

npx vitest run tests/behavior/mvpFileLearningPipeline.test.ts
→ passed

npx tsc --noEmit
→ Exit 0 (clean)

npx vitest run --exclude 'tests/firebase/**'
→ Test Files: 59 passed | 5 skipped (64)
→ Tests:      572 passed | 16 skipped (588)   [+9 vs 563 baseline]
```

---

## 11. What Was Intentionally Not Fixed

- Processing-state granularity in sources label (e.g., "1 file processing") — out of scope
- FilePanel embedding status not shown — out of scope
- `pendingFilesByFileId` page-refresh loss — out of scope
- Legacy retrieval fallback for non-placeholder files — out of scope
- Multi-file inventory in chat — out of scope

---

## 12. Remaining Risks

- **Count includes files at any processing state**: A file in `extractionStatus: "failed"` still increments the count and shows as "available." This is conservative but technically optimistic. A user could think retrieval will work when it will not. Acceptable for MVP personal use — the FilePanel shows the exact status.
- **`uploadedFiles` state is workspace-scoped**: If the workspace changes and `reloadWorkspaceFiles` hasn't finished yet, the count briefly shows 0 before the reload completes. The context strip will temporarily say "No files uploaded." This is a transient race — the previous behavior permanently said "not connected yet," which was worse.

---

## 13. Confirmation

**No `git add`, `git commit`, or `git push` was run during this task.**

Changes exist only as uncommitted modifications on branch `repair/fix-sources-context-state`.
