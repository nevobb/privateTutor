# PDF Reading Batch 6C — Artifact-aware File Inventory Report

## 1. Branch name and HEAD commit
- Branch: `repair/artifact-aware-file-inventory`
- HEAD: `9d352b5 feat: run text-only document understanding after chunking`

## 2. Files changed
- `src/server/tutor/fileInventoryService.ts`
- `src/server/workspaces/sessionMessageApiService.ts`
- `tests/server/tutor/fileInventoryService.test.ts`
- `tests/server/workspaces/sessionMessageApiService.test.ts`
- `tests/behavior/mvpFileLearningPipeline.test.ts`
- `agent-memory/PDF_READING_BATCH_6C_ARTIFACT_AWARE_INVENTORY_REPORT.md`
- `agent-memory/DUAL_AGENT_SYNC_LOG.md`

## 3. Exact inventory integration point
- Inventory routing still happens in `src/server/workspaces/sessionMessageApiService.ts` inside the existing `file_content_inventory` shortcut branch.
- Batch 6C adds a narrow pre-fallback read path there:
  - `maybeBuildArtifactAwareInventoryContent(...)`
- If that helper returns useful artifact-based content, the inventory response uses it.
- If it returns `null` or artifact loading fails, the existing chunk-based `buildFileInventory(...)` + `formatFileInventoryResponse(...)` fallback runs unchanged.

## 4. Artifact-read behavior
- Artifact-aware inventory is attempted only when the ready uploaded file has `understandingStatus === "completed"`.
- The helper reads:
  - `listDocumentPages(...)`
  - `getDocumentOutline(...)`
  - `listDetectedQuestions(...)`
- Inventory is considered useful when artifacts provide at least one of:
  - detected question entries
  - outline sections
  - page count
  - outline title
  - detected question count > 0
- The cleaner artifact path prefers detected questions first, then outline sections if needed.
- Artifact entries use structured fields like:
  - question label
  - summary/topic
  - page hint
  - partial-confidence marker
- The artifact path intentionally avoids chunk-preview dumping.

## 5. Fallback behavior
- If `understandingStatus` is missing, failed, pending, or not completed → fallback to chunk inventory.
- If artifacts are empty/not useful → fallback to chunk inventory.
- If artifact repository reads throw or return unusable data → fallback to chunk inventory.
- Batch 6C does not trigger document understanding, re-chunking, re-extraction, or Gemini.

## 6. Quality / deepPdfStatus wording
- When artifact metadata indicates `extractionQuality === "partial"` or `"poor"`, the response includes one honest warning:
  - that formulas/symbols/document structure were extracted only partially
  - that some sections are therefore only partially identified
- When `deepPdfStatus === "recommended"`, the response includes exactly the recommendation-style wording:
  - `המסמך כנראה דורש עיבוד מתקדם יותר כדי להבין נוסחאות/תרשימים בצורה אמינה.`
- The response does **not** claim Gemini already ran.
- The response still does **not** claim visual PDF understanding.

## 7. Confirmation that Gemini is not called
- Batch 6C does not import or call `GeminiPdfUnderstandingProvider`.
- Batch 6C does not add any Gemini runtime call path.
- The artifact-aware inventory path reads only persisted local Firestore artifacts and file metadata.

## 8. Confirmation that normal tutor / retrieval / upload / UI behavior was not changed
- Normal tutor Q&A behavior was not changed.
- Retrieval behavior was not changed.
- Upload / extraction / chunking behavior was not changed.
- UI behavior was not changed.
- The only runtime behavior change is within the deterministic file inventory shortcut.

## 9. Tests added / updated
Updated `tests/server/tutor/fileInventoryService.test.ts` to cover:
- building artifact-aware inventory from detected questions
- returning `null` when artifact data is too empty to be useful
- cleaner formatted artifact-aware inventory output
- honest partial/poor extraction warning
- `deepPdfStatus === "recommended"` wording without claiming Gemini ran

Updated `tests/server/workspaces/sessionMessageApiService.test.ts` to cover:
- using persisted artifacts when `understandingStatus === "completed"`
- not calling chunk fallback when artifacts are useful
- fallback when `understandingStatus` is missing
- fallback when `understandingStatus === "failed"`
- artifact-aware poor-extraction warning
- artifact-aware `deepPdfStatus === "recommended"` wording

Updated `tests/behavior/mvpFileLearningPipeline.test.ts` to cover:
- exact uploaded-file inventory smoke phrase using artifact-aware inventory without model call
- no raw garbled snippet exposure from fallback chunks when artifacts are present

## 10. Validation results
- `npx tsc --noEmit` — passed
- `npx vitest run` — passed (`63` files passed, `18` skipped; `708` tests passed, `121` skipped)
- `npm run build` — passed
- `git diff --check` — passed
- `graphify update .` — passed

## 11. Risks / open decisions
- The artifact-aware inventory path currently prefers one ready file, matching the existing inventory shortcut behavior.
- Batch 6C keeps page-aware facts limited to page counts and per-question page hints; it does not yet surface richer source/page references in the tutor UI.
- Later batches still need to decide when specific-question retrieval should use `detectedQuestions` first.

## 12. Confirmation that no git add / commit / push was run
- Confirmed:
  - No `git add`
  - No `git commit`
  - No `git push`

## 13. Confirmation that no git pull was run
- Confirmed:
  - No `git pull`
