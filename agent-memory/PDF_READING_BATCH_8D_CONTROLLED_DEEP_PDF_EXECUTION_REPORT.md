# PDF Reading Batch 8D — Controlled Deep PDF Execution Report

## 1. Branch name and HEAD commit
- Branch: `repair/controlled-deep-pdf-execution`
- HEAD at start: `8b2d595 feat: add Deep PDF cache metadata policy`

## 2. Files changed
New files created:
- `src/server/workspaces/deepPdfOrchestrationService.ts`
- `tests/server/workspaces/deepPdfOrchestrationService.test.ts`

Modified:
- `src/server/workspaces/uploadedFileApiService.ts`

Memory/docs created:
- `agent-memory/PDF_READING_BATCH_8D_CONTROLLED_DEEP_PDF_EXECUTION_REPORT.md`
- `agent-memory/DUAL_AGENT_SYNC_LOG.md` (sync entry appended)

## 3. Exact execution integration point

**Location:** `uploadedFileApiService.ts` → `maybeRunTextOnlyDocumentUnderstandingAfterChunking()`

After the text-only understanding run + quality gate evaluation + `deepPdfStatus = "recommended"` marking, a new best-effort call to `deepPdfOrchestrationService.runDeepPdfUnderstanding(userId, fileId, { costMode: "Normal Learning" })` is attempted.

```
runChunkingLifecycleForFile:
  → chunkExtractedText
  → replaceFileChunks
  → updateUploadedFile(chunkingStatus: "completed")
  → maybeRunTextOnlyDocumentUnderstandingAfterChunking:
      → runTextOnlyUnderstanding (text-only artifacts)
      → evaluateDocumentQualityGate
      → if quality gate recommends → update deepPdfStatus = "recommended"
      → [NEW] deepPdfOrchestrationService.runDeepPdfUnderstanding (controlled Deep PDF pass)
  → return fileAfterUnderstanding
```

The call is wrapped in a `try/catch` so any Deep PDF failure is fully isolated from the chunking lifecycle.

### Cost mode at integration point

`runChunkingLifecycleForFile` does not receive a costMode parameter — it is not available in the post-chunking lifecycle today. Per product decision: **default to "Normal Learning"**, which is the app-wide default (set in `page.tsx` as initial state). This is documented here and in risks.

## 4. Guard conditions implemented

All guards run in sequence; each early-returns safely before any Gemini call:

| # | Guard | Skip/Fail code |
|---|---|---|
| 1 | file exists | `failed: file_not_found` |
| 2 | `sourceType === "pdf"` | `skipped: wrong_source_type` |
| 3 | `storagePath` is non-empty | `skipped: missing_storage_path` |
| 4 | `GEMINI_API_KEY` env var present | `skipped: missing_api_key` |
| 5 | Cache policy — `use_existing_result` | `skipped: cache_use_existing_result` |
| 6 | Cache policy — `shouldRunDeepPdfProcessing` | `skipped: <cache decision reason>` |
| 7 | Loader succeeds and returns non-empty bytes | `failed: bytes_load_failed:…` |
| 8 | Provider output has empty `errors` array | `failed: provider_error:…` |
| 9 | No unhandled exception | `failed: orchestration_error:…` |

Guard 6 covers: `already_pending`, `not_eligible`, `blocked_by_cost_mode`, `reprocess_needed_*`, `insufficient_identity_metadata`.

## 5. Cost mode behavior

| Cost mode | Behavior |
|---|---|
| `Normal Learning` | Auto-run when `deepPdfStatus === "recommended"` and all guards pass |
| `Deep Research` | Auto-run when `deepPdfStatus === "recommended"` and all guards pass |
| `Cheap Practice` | Always skipped — cache policy `allowsFutureAutoRun` returns false |
| undefined | Defaults to "Normal Learning" behavior |

**Default at post-chunking lifecycle:** `"Normal Learning"` — explicitly hardcoded at the call site in `uploadedFileApiService.ts`, with a comment documenting why. This matches the app's declared default costMode in `page.tsx`.

## 6. Cache/reuse behavior

The Batch 8B cache policy (`evaluateDeepPdfCacheState`) is evaluated before any Gemini call:

| Cache decision | Action |
|---|---|
| `use_existing_result` | Skip (Gemini not called, loader not called) |
| `already_pending` | Skip (prevents duplicate concurrent run) |
| `eligible_for_future_auto_run` | Run (cost mode allows, deepPdfStatus is "recommended") |
| `retry_allowed_later` | Run (deepPdfStatus is "failed", cost mode allows retry) |
| `blocked_by_cost_mode` | Skip |
| `reprocess_needed_*` | Skip for Batch 8D (shouldRunProcessing = false for these) |
| `insufficient_identity_metadata` | Skip |
| `not_eligible` | Skip |

**Gemini never reruns on a completed file whose identity/provider/version match.** The `use_existing_result` path is explicitly tested.

## 7. Pending/completed/failed lifecycle behavior

### Pending (optimistic lock)
Before calling the loader or provider:
- `deepPdfStatus = "pending"`
- `deepPdfUpdatedAt = now`
- `deepPdfErrorCode = null`

If another request already set status to "pending", the cache check at step 4 returns `already_pending` and exits without calling Firestore update.

### Completed
After successful provider run + artifact persistence:
- `deepPdfStatus = "completed"`
- `understandingMode = "deep_pdf"`
- `deepPdfProviderName`, `deepPdfModel`
- `deepPdfInputHash`, `deepPdfStorageGeneration`
- `deepPdfArtifactVersion = CURRENT_DEEP_PDF_ARTIFACT_VERSION`
- `deepPdfCompletedAt = now`, `deepPdfUpdatedAt = now`
- `deepPdfErrorCode = null`
- `pageCount`, `outlineTitle`, `detectedQuestionCount`, `extractionQuality` — upgraded from provider output if available

### Failed
On any failure (loader, provider errors, provider throw, unhandled exception):
- `deepPdfStatus = "failed"`
- `deepPdfErrorCode = "<type>:<truncated message>"` (max 120 chars, no raw content)
- `deepPdfUpdatedAt = now`
- Text-only artifacts are NOT removed — they remain as fallback

## 8. PDF loader integration

`FirebaseStoragePdfBytesLoader.loadPdfBytesWithMetadata()` is called to:
1. Validate storage path ownership
2. Fetch bytes from Firebase Storage
3. Return `bytes`, `inputHash` (sha256), `storageGeneration` (GCS generation)

The bytes are passed **inline** to `provider.run({ ...input, pdfBytes: bytes })`. The provider does NOT need a loader injected — it uses `input.pdfBytes` directly (existing `resolvePdfBytes` logic in `GeminiPdfUnderstandingProvider`).

This keeps identity metadata capture in the orchestration service, not inside the provider.

## 9. Gemini provider integration

- Provider: `GeminiPdfUnderstandingProvider` (existing, unchanged)
- Called via `DocumentUnderstandingProvider` interface
- Input: `{ userId, workspaceId, fileId, fileName, storagePath, sourceType: "pdf", pdfBytes: bytes, mode: "deep_pdf" }`
- Success: `output.errors.length === 0` — provider output processed normally
- Failure: `output.errors.length > 0` OR provider throws → marked failed

Provider error messages are truncated to 120 chars before storage in `deepPdfErrorCode`. Raw provider errors are not exposed in the service's returned `errorCode`.

## 10. Artifact persistence behavior

On successful Deep PDF run, existing artifact collections are **replaced** with Deep PDF-derived content (same paths as text-only, following Batch 8A recommendation):

- `users/{userId}/uploadedFiles/{fileId}/pages/` — via `replaceDocumentPages`
- `users/{userId}/uploadedFiles/{fileId}/documentOutline/v1` — via `saveDocumentOutline`
- `users/{userId}/uploadedFiles/{fileId}/detectedQuestions/` — via `replaceDetectedQuestions`

Existing text-only artifacts are overwritten. The `understandingMode = "deep_pdf"` metadata field distinguishes which understanding level is active.

## 11. Error handling behavior

- `deepPdfOrchestrationService.runDeepPdfUnderstanding` **never throws** — always returns `DeepPdfRunResult`
- The integration call in `uploadedFileApiService.ts` is wrapped in a `try/catch` — any unexpected throw from the service is suppressed so chunking lifecycle never fails
- `deepPdfErrorCode` is always truncated to 120 chars
- No raw PDF bytes, PDF text content, or API keys appear in error messages
- Failed Deep PDF leaves text-only artifacts intact

## 12. Tests added/updated

### `tests/server/workspaces/deepPdfOrchestrationService.test.ts` (34 tests)

All tests use mocked provider, loader, and repository deps. No real Gemini or Firebase calls.

**Successful run (9 tests):** marks pending → calls loader → calls provider with pdfBytes → persists all three artifact types → marks completed → stores all identity metadata (hash, generation, provider, model, artifactVersion, completedAt) → updates pageCount → returns completed status.

**Completed reusable result (3 tests):** skipped status, loader not called, provider not called.

**Already pending (2 tests):** skipped status, loader not called.

**Cheap Practice (2 tests):** skipped status, no Gemini/loader calls.

**Missing API key (2 tests):** skipped with `missing_api_key` reason, no calls.

**Loader failure (3 tests):** marked failed with `bytes_load_failed:*` errorCode, provider not called, doesn't throw.

**Provider failure (4 tests):** errors array → failed; provider throws → failed; raw error not exposed in result; doesn't throw.

**Failed retry (2 tests):** Normal Learning allows retry; Cheap Practice blocks retry.

**Structural guards (3 tests):** docx skipped; missing storagePath skipped; missing file = failed.

**Chunking lifecycle isolation (1 test):** service resolves even on unrecoverable error.

**Deep Research (1 test):** runs when recommended.

**Default cost mode (1 test):** defaults to Normal Learning, runs successfully.

**Regression via full suite:** 66 test files / 794 tests all pass. Existing cache policy, loader, provider, inventory, question grounding, upload/extract/chunk tests unaffected.

## 13. Validation results
- `npx tsc --noEmit` — ✅ passed
- `npx vitest run` — ✅ 66 files passed, 18 skipped; 794 tests passed, 121 skipped
- `npm run build` — ✅ passed
- `git diff --check` — ✅ passed
- `graphify update .` — ✅ 4175 nodes, 5751 edges, 290 communities

## 14. What was intentionally not implemented
- No UI or user-facing toggle.
- No inventory wording changes.
- No tutor response behavior changes.
- No retrieval behavior changes.
- No old file bulk processing or backfill.
- No on-demand tutor-question-triggered Deep PDF execution (that is Batch 8E scope).
- No concurrent run lock beyond the optimistic "mark pending" step.
- No PDF magic bytes validation (documented risk from Batch 8C).
- No re-read after marking pending (race condition mitigation deferred to Batch 8E).
- No per-session costMode propagation into the lifecycle (documented in risks).

## 15. Risks / open decisions

### Cost mode defaulting
`"Normal Learning"` is hardcoded at the `maybeRunTextOnlyDocumentUnderstandingAfterChunking` call site. This is correct for today's app behavior (all sessions default to Normal Learning). A future batch should propagate costMode through `runChunkingLifecycleForFile` if per-session cost mode needs to gate Deep PDF at upload time.

### Optimistic pending lock
There is a small race window between the cache policy check and the `deepPdfStatus = "pending"` update. Two concurrent upload flows could both pass the cache check and both attempt the run. The second one's pending update will succeed (Firestore is last-write-wins), and the cache check on a re-read would see "pending" — but only if re-read before the first completes. For an MVP background lifecycle, this is acceptable. A future Batch 8E hardening can add a Firestore conditional update or distributed lock.

### Provider errors not differentiated
`output.errors.length > 0` is treated as failure regardless of error content. Future batches can parse error codes from provider output to distinguish retryable vs permanent failures.

### Deep PDF artifacts replace text-only artifacts
Text-only artifacts are replaced on Deep PDF success. If Deep PDF produces lower-quality output than text-only (unlikely but possible), there is no rollback path. Future batches can add artifact versioning to support rollback.

### PDF magic bytes not validated
Loader accepts any `application/pdf` content type without checking `%PDF-` header. Low risk since storage path ownership is validated, but a future hardening step should add it.

## 16. Ready for Batch 8E — tutor behavior/state handling?
**YES**

Batch 8E can:
1. Read `understandingMode`, `deepPdfStatus` from file metadata to know which artifact tier is active.
2. Update tutor inventory/Q&A routing to prefer Deep PDF artifacts when `deepPdfStatus === "completed"`.
3. Add honest messaging for `deepPdfStatus === "pending"` (brief "deeper reading being prepared").
4. Add on-demand Deep PDF triggering for existing older files when a user asks about them.

## 17. Confirmation that Gemini does not rerun on reusable completed files
Confirmed: `evaluateDeepPdfCacheState` returns `use_existing_result` when `deepPdfStatus === "completed"` and provider/model/artifact version and input identity still match. `shouldUseExistingDeepPdfResult` returns `true`, and the service returns `{ status: "skipped" }` before any loader or provider call. Explicitly tested in the "completed reusable result" test group.

## 18. Confirmation that no UI/toggle was added
Confirmed: no UI components, no user-facing controls, no API routes modified.

## 19. Confirmation that no git add / commit / push was run
Confirmed:
- No `git add`
- No `git commit`
- No `git push`

## 20. Confirmation that no git pull was run
Confirmed:
- No `git pull`
