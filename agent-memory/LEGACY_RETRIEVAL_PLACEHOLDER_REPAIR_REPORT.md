# Legacy Retrieval Placeholder Repair Report

**Branch:** repair/remove-legacy-retrieval-placeholder  
**Date:** 2026-06-02

---

## 1. Branch

`repair/remove-legacy-retrieval-placeholder`

---

## 2. Starting Issue

`executeLegacyIndexedFileRetrieval()` in `sessionMessageApiService.ts` served as a fallback when semantic/keyword chunk retrieval returned `eligibleFileCount === 0`. It selected files by `indexingStatus === "indexed"` and built citations from `file.summaryText`.

During Phase 8 (metadata-only indexing), `uploadedFileApiService` wrote `"Summary placeholder; content extraction not enabled yet."` as `summaryText` for every file. This text remained in Firestore even after Phase 9+ added real extraction.

The legacy fallback therefore could:
1. Set `retrieval.used = true` — diagnostics report successful retrieval
2. Build citations with `referenceText = "Summary placeholder; content extraction not enabled yet."`
3. Attach those citations to the assistant message

While the placeholder text does NOT reach the LLM grounding context (legacy path always returns `retrievedChunks: []`, so the second grounding call is never made), it creates false source citations visible to the user and incorrect diagnostic state. The tutor appears to have retrieved real file content when it has none.

---

## 3. Graphify Commands Used

```
graphify query "executeLegacyIndexedFileRetrieval placeholder grounding context retrieval decision"
graphify update .
```

First query confirmed `executeLegacyIndexedFileRetrieval()` node inside `sessionMessageApiService.ts` with edges to `executeRetrievalForTutorResponse()`. No upstream edges connected it to chunk retrieval or grounding injection — confirming it is a separate fallback path.

---

## 4. Files Inspected

- `src/server/workspaces/sessionMessageApiService.ts` — `executeLegacyIndexedFileRetrieval`, `executeRetrievalForTutorResponse`, grounding injection at line 284
- `src/server/workspaces/uploadedFileApiService.ts` — `SUMMARY_PLACEHOLDER_TEXT` constant (private, line 22)
- `tests/server/workspaces/sessionMessageApiService.test.ts` — `makeRepos()` default file, existing retrieval tests
- `tests/behavior/mvpFileLearningPipeline.test.ts` — confirmed unaffected (uses real chunk content)
- `tests/server/tutor/retrievalDecisionBoundary.test.ts` — confirmed unaffected

---

## 5. Files Changed

| File | What changed |
|---|---|
| `src/server/workspaces/sessionMessageApiService.ts` | Add `LEGACY_SUMMARY_PLACEHOLDER` constant; filter placeholder files in `executeLegacyIndexedFileRetrieval` |
| `tests/server/workspaces/sessionMessageApiService.test.ts` | Fix `makeRepos()` default `summaryText`; add 2 new tests |

---

## 6. Exact Implementation Summary

### `src/server/workspaces/sessionMessageApiService.ts`

**Added constant (near line 34):**
```typescript
// Phase 8 metadata-only indexing wrote this placeholder as summaryText for all files.
// It has no informational value and must not be injected into the tutor grounding context.
const LEGACY_SUMMARY_PLACEHOLDER = "Summary placeholder; content extraction not enabled yet.";
```

**Replaced body of `executeLegacyIndexedFileRetrieval`** — after sorting and slicing to `selected`, added a filter before building citations:

```typescript
// Exclude Phase 8 placeholder summaries — they contain no real content.
const usableFiles = selected.filter(
  (file) => !(file.summaryStatus === "ready" && file.summaryText === LEGACY_SUMMARY_PLACEHOLDER)
);

if (usableFiles.length === 0) {
  tutorResponse.internalUpdate.retrieval = {
    ...tutorResponse.internalUpdate.retrieval,
    used: false,
    scope: decision.retrieval_scope,
    source_ids: [],
    why: "retrieval_skipped_placeholder_content_only",
  };
  tutorResponse.decisionLogEvents?.push({
    type: "retrieval_skipped",
    title: "Retrieval skipped",
    detail: "All indexed files contain only placeholder summaries — no real extracted content available.",
  });
  return { citations: tutorResponse.message.citations, retrievedChunks: [] };
}
```

The rest of the function uses `usableFiles` instead of `selected` for `sourceIds`, `retrieval.used = true`, and citation building.

**Diff summary:** 1 constant added (~4 lines), 1 filter block added (~14 lines), 3 variable references changed (`selected` → `usableFiles`). No structural changes.

---

## 7. How Placeholder Grounding Is Now Blocked

**Before fix — runtime path when only placeholder files exist:**
```
retrieveFileChunks → eligibleFileCount=0
  → executeLegacyIndexedFileRetrieval
    → indexed = [file with summaryText="Summary placeholder..."]
    → selected = [file]
    → citations = [{ referenceText: "Summary placeholder..." }]
    → retrieval.used = true  ← WRONG
    → appendMessage(citations)  ← placeholder text attached to response
```

**After fix — same scenario:**
```
retrieveFileChunks → eligibleFileCount=0
  → executeLegacyIndexedFileRetrieval
    → indexed = [file with summaryText="Summary placeholder..."]
    → selected = [file]
    → usableFiles = []  ← filtered by LEGACY_SUMMARY_PLACEHOLDER check
    → retrieval.used = false, why = "retrieval_skipped_placeholder_content_only"
    → return { citations: [], retrievedChunks: [] }  ← no injection
```

The decision log records `"All indexed files contain only placeholder summaries"` making the skip reason auditable.

---

## 8. How Real Retrieval Content Is Preserved

The filter condition is narrow:
```typescript
!(file.summaryStatus === "ready" && file.summaryText === LEGACY_SUMMARY_PLACEHOLDER)
```

Only files where BOTH conditions are true are excluded:
- `summaryStatus === "ready"` AND
- `summaryText` is the exact Phase 8 placeholder string

Files with real `summaryText`, files with `summaryStatus !== "ready"`, and files with `summaryText === null` all pass through to the citation builder unchanged. The existing `makeIndexedFiles(count)` helper (used by budget tests) produces files with `summaryText: "Summary ${i+1}"` — distinct from the placeholder — and continues to work correctly.

---

## 9. Tests Added/Updated

### Updated (1)

**`makeRepos()` default `summaryText`** changed from `"Summary placeholder; content extraction not enabled yet."` to `"Mechanics course overview: Newton's laws, kinematics, energy conservation."`. The default test fixture now represents a file with real extracted content — matching realistic state after Phase 9+ extraction. The test at line 225 (`retrieval.used = true` assertion) remains correct because the default file now has real content that passes the filter.

### Added (2)

1. **"does not use placeholder summaryText as grounding — reports retrieval_skipped_placeholder_content_only"**  
   Sends a message with only a placeholder-summary file indexed. Asserts:
   - `retrieval.used = false`
   - `retrieval.why = "retrieval_skipped_placeholder_content_only"`
   - `source_ids.length = 0`
   - No citation `referenceText` contains `"Summary placeholder"`

2. **"uses real summaryText as grounding when available alongside placeholder files"**  
   Sends a message with one real file and one placeholder file indexed. Asserts:
   - `retrieval.used = true`
   - `source_ids` contains the real file's ID
   - `source_ids` does NOT contain the placeholder file's ID

---

## 10. Validation Commands and Results

```
npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts
→ 1 test file, 47 tests passed  [+2 new]

npx vitest run tests/server/tutor/retrievalDecisionBoundary.test.ts
→ passed

npx vitest run tests/behavior/mvpFileLearningPipeline.test.ts
→ passed

npx tsc --noEmit
→ Exit 0 (clean)

npx vitest run --exclude 'tests/firebase/**'
→ Test Files: 59 passed | 5 skipped (64)
→ Tests:      563 passed | 16 skipped (579)   [+2 vs 561 baseline]
```

---

## 11. What Was Intentionally Not Fixed

- `pendingFilesByFileId` page-refresh loss — out of scope
- Context strip "Sources: not connected yet" — out of scope
- Embedding status not shown in FilePanel — out of scope
- `executeLegacyIndexedFileRetrieval` itself not deleted — kept as fallback for files with real summaryText (e.g. future AI-generated summaries)
- Multi-file inventory — out of scope

---

## 12. Remaining Risks

- **`executeLegacyIndexedFileRetrieval` still active for real `summaryText`**: If a file has `summaryStatus === "ready"` and a real (non-placeholder) `summaryText`, the legacy path still fires and returns that text as a citation. This is intended — it is real content. However, this content is NOT injected into grounding (since legacy always returns `retrievedChunks: []`). The grounding injection only happens via the chunk retrieval path. Legacy citations are metadata-level pointers, not grounding text.
- **Exact string match**: The filter uses strict equality (`=== LEGACY_SUMMARY_PLACEHOLDER`). If the placeholder string is ever truncated or reformatted in future Firestore records, the guard would not catch it. This is acceptable for the current data set — all Phase 8 records use the exact same string from `uploadedFileApiService.ts`.
- **`summaryText` not in `summaryStatus !== "ready"` files**: Files with `summaryStatus === "failed"` or `"not_requested"` have `summaryText = null` and fall back to `"Retrieved from indexed file: ${file.name}"`. This is a file-name citation, not content injection. Not blocked here — it's clearly labeled, not placeholder text.

---

## 13. Confirmation

**No `git add`, `git commit`, or `git push` was run during this task.**

Changes exist only as uncommitted modifications on branch `repair/remove-legacy-retrieval-placeholder`.
