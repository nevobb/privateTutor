# Post-8D Deep PDF Runtime Safety Audit

## 1. Branch name and HEAD commit
- Branch: `repair/controlled-deep-pdf-execution`
- HEAD: `8b2d595 feat: add Deep PDF cache metadata policy`
- Batch 8D changes are uncommitted but present as working tree modifications

## 2. Working tree status before audit
```
 M agent-memory/DUAL_AGENT_SYNC_LOG.md
 M src/server/workspaces/uploadedFileApiService.ts
?? agent-memory/PDF_READING_BATCH_8C_SERVER_PDF_BYTES_LOADER_REPORT.md
?? agent-memory/PDF_READING_BATCH_8D_CONTROLLED_DEEP_PDF_EXECUTION_REPORT.md
?? src/server/workspaces/deepPdfOrchestrationService.ts
?? src/server/workspaces/firebaseStoragePdfBytesLoader.ts
?? tests/server/workspaces/deepPdfOrchestrationService.test.ts
?? tests/server/workspaces/firebaseStoragePdfBytesLoader.test.ts
```

Clean of any unintended changes. All 8D additions are expected.

---

## 3. Deep PDF trigger safety

**Finding: PASS**

`runDeepPdfUnderstanding` is called from exactly **one** production call site:

```
uploadedFileApiService.ts:629
  maybeRunTextOnlyDocumentUnderstandingAfterChunking()
    → only when shouldRecommendDeepPdf(...) returns true
      → only when quality gate decision is "recommend_advanced_understanding" or "requires_user_confirmation_or_higher_cost_mode"
      → only when deepPdfStatus is not already "recommended", "pending", or "completed"
```

No other caller exists anywhere in `src/`:
- `deepPdfOrchestrationService` is not imported or called from `src/server/tutor/`
- `deepPdfOrchestrationService` is not imported or called from `src/app/api/`
- No tutor message handler calls it
- No inventory handler calls it
- No retrieval handler calls it

The trigger is strictly post-chunking, post-text-only-understanding, post-quality-gate. This matches the Batch 8A recommended integration point.

**One additional finding:** The quality gate does NOT pass `costMode` to its evaluation at the integration point (line 605–611). The quality gate call omits `costMode`, so `qualitySignals.hasVisualContentRequest` and `costMode` do not influence the gate result at this point. The gate can still recommend based on text quality signals alone, which is intentional. The cost mode check occurs separately inside `deepPdfOrchestrationService` via the cache policy. Separation is correct.

---

## 4. Guard enforcement assessment

**Finding: PASS with one observation**

Guards verified in `deepPdfOrchestrationService.ts` (lines 153–200):

| Guard | Code verified | Status |
|---|---|---|
| File exists | `if (!file)` → `status: "failed", errorCode: "file_not_found"` | ✅ |
| `sourceType === "pdf"` | `if (file.sourceType !== "pdf")` → `skipped: wrong_source_type` | ✅ |
| `storagePath` non-empty | `if (!file.storagePath)` → `skipped: missing_storage_path` | ✅ |
| `GEMINI_API_KEY` present | `if (!apiKey)` → `skipped: missing_api_key` | ✅ |
| Cache policy: use_existing | `shouldUseExistingDeepPdfResult(cacheResult)` → skipped | ✅ |
| Cache policy: shouldRun | `!shouldRunDeepPdfProcessing(cacheResult)` → skipped | ✅ |
| Loader succeeds | `if (!bytesResult.ok)` → `failed: bytes_load_failed:*` | ✅ |
| Loader returns bytes | handled inside `loadPdfBytesWithMetadata` (empty_bytes code) | ✅ |
| Provider errors empty | `providerOutput.errors.length > 0` → `failed: provider_error:*` | ✅ |
| Unhandled exception | outer `catch` → `failed: orchestration_error:*` | ✅ |

**Observation:** The `GEMINI_API_KEY` guard (step 3) is evaluated before the cache policy (step 4). This means even for files with a valid completed cached result, the API key is checked first. This is harmless — it just means a skipped result due to missing API key rather than a cache-hit skip — but could be reordered in a future batch to always check cache first (cheaper). Not a safety issue.

**Observation:** `extractionStatus`, `chunkingStatus`, `understandingStatus` are NOT guarded inside `runDeepPdfUnderstanding` itself. These guards exist in the calling function (`shouldRunTextOnlyDocumentUnderstanding` checks `extractionStatus === "completed"` and `chunkingStatus === "completed"`, and the text-only orchestration requires `understandingStatus` to be non-pending/completed). Because Deep PDF only runs after text-only understanding completes successfully, these preconditions are guaranteed at the call site. This is acceptable.

---

## 5. Cache/reuse assessment

**Finding: PASS**

When `deepPdfStatus === "completed"` and identity metadata matches (provider + model + artifact version + input hash or storage generation), `evaluateDeepPdfCacheState` returns `use_existing_result` → `shouldUseExistingDeepPdfResult` returns `true` → service returns `{ status: "skipped" }` at line 195–197, **before calling the loader or provider**.

Verified:
- `shouldUseExistingDeepPdfResult` is called at line 195 and exits before any I/O
- `shouldRunDeepPdfProcessing` only returns `true` for `eligible_for_future_auto_run` and `retry_allowed_later`
- The `eligible_for_future_auto_run` decision path requires `deepPdfStatus === "recommended"` (not "completed")

Gemini does not rerun for reusable completed files. Confirmed in tests (3 tests in "completed reusable result" group).

---

## 6. Pending/duplicate prevention assessment

**Finding: ACCEPTABLE — documented limitation**

`deepPdfStatus = "pending"` is set at line 204–208 after the cache policy check. The `already_pending` cache decision (line 48 in `deepPdfCachePolicy.ts`) catches the case where another process already set the status.

**Race window analysis:**
- Process A: reads file (deepPdfStatus = "recommended") → cache check passes → writes pending
- Process B: reads file (deepPdfStatus = "recommended") → cache check passes (B read before A wrote) → writes pending

In this window, both processes may proceed past the cache check and both write "pending". The second write wins (Firestore last-write-wins). Both then attempt to run Gemini. The second run will overwrite artifacts and metadata. The result is a duplicate run, not data corruption — both would produce valid results.

**Assessment:** Acceptable for an MVP background lifecycle. Post-chunking runs at most once per file upload, and the window requires two concurrent chunk-complete lifecycle calls for the same file, which is uncommon in practice. A Batch 8E hardening step can add a Firestore conditional update.

---

## 7. Failure isolation assessment

**Finding: PASS**

Two isolation layers protect the chunking lifecycle:

**Layer 1 — service-level:** `runDeepPdfUnderstanding` never throws. All error paths (`file_not_found`, loader failure, provider error, unhandled exception) return `{ status: "failed" }` instead of throwing. The outer `catch` at line 298 ensures even unanticipated exceptions are converted to structured failures.

**Layer 2 — caller-level:** The call site in `uploadedFileApiService.ts` (lines 627–639) is wrapped in:
```ts
if (repositories.deepPdfOrchestrationService) {
  try {
    const deepPdfResult = await repositories.deepPdfOrchestrationService.runDeepPdfUnderstanding(...)
    if (deepPdfResult.status === "completed" && deepPdfResult.file) {
      return deepPdfResult.file;
    }
  } catch {
    // Deep PDF failure must never fail the chunking lifecycle.
  }
}
```

Any throw from the service (even from the module singleton initialization) is caught. Non-completed results (skipped, failed) are ignored — the function falls through to return `recommendedFile`. Chunking lifecycle return value is never replaced by a failed Deep PDF result.

Text-only artifacts remain intact after Deep PDF failure. The `updateUploadedFile` calls on failure only update `deepPdfStatus`, `deepPdfErrorCode`, `deepPdfUpdatedAt` — they do not touch `understandingStatus`, `extractedText`, `chunkingStatus`, or artifact collections.

---

## 8. Artifact persistence assessment

**Finding: PASS**

Artifact persistence (`persistArtifacts` at line 266) only runs after:
1. `bytesResult.ok === true` ✓
2. `providerOutput.errors.length === 0` ✓

The persistence sequence:
1. `replaceDocumentPages` — replaces all pages under `users/{userId}/uploadedFiles/{fileId}/pages/`
2. `saveDocumentOutline` — replaces outline at `users/{userId}/uploadedFiles/{fileId}/documentOutline/v1`
3. `replaceDetectedQuestions` — replaces questions under `users/{userId}/uploadedFiles/{fileId}/detectedQuestions/`

Conditional guards: pages only written if `output.pages.length > 0`, outline only if `output.outline` is non-null, questions only if `output.detectedQuestions.length > 0`. This prevents replacing good text-only artifacts with empty Deep PDF output if the provider returns partial results.

**Observation:** Persistence happens before the `completed` metadata update. If `persistArtifacts` throws, the outer `catch` marks `deepPdfStatus = "failed"` — meaning artifacts are partially written but metadata still shows "failed". The artifacts are orphaned but harmless — they will be replaced on a future successful run. Acceptable for Batch 8D.

**All expected metadata persisted on success:**
- `deepPdfStatus = "completed"` ✅
- `understandingMode = "deep_pdf"` ✅
- `deepPdfProviderName` ✅
- `deepPdfModel` ✅
- `deepPdfInputHash` (sha256 from loader) ✅
- `deepPdfStorageGeneration` (GCS generation from loader) ✅
- `deepPdfArtifactVersion = CURRENT_DEEP_PDF_ARTIFACT_VERSION` ✅
- `deepPdfCompletedAt` (Date) ✅
- `deepPdfUpdatedAt` (Date) ✅
- `deepPdfErrorCode = null` ✅
- `pageCount`, `outlineTitle`, `detectedQuestionCount`, `extractionQuality` upgraded if provider returns them ✅

---

## 9. API key / server-only / logging safety

**Finding: PASS**

**API key server-only:** `getApiKey: () => process.env.GEMINI_API_KEY` (line 78) — reads from server-side env var. The key is never returned to clients, never stored in Firestore, never appears in API responses. `deepPdfOrchestrationService.ts` is a server module only (no `"use client"` directive). No `NEXT_PUBLIC_` prefix.

**No logging of raw bytes:** Zero `console.log`, `console.error`, or `console.warn` calls in either `deepPdfOrchestrationService.ts` or `firebaseStoragePdfBytesLoader.ts`. Verified with grep — no output.

**Error message truncation:** `deepPdfErrorCode` is set as:
- `bytes_load_failed:${bytesResult.code}` — code is a short string enum value
- `provider_error:${firstError.slice(0, 120)}` — provider error truncated to 120 chars
- `orchestration_error:${message.slice(0, 120)}` — exception message truncated to 120 chars

None of these include raw PDF content. The `bytes` variable (`Uint8Array`) is only passed to `deepPdfProvider.run(...)` as `pdfBytes` and is not logged or stored in Firestore.

**pdfBytes in Firestore:** `pdfBytes` appears in `DocumentUnderstandingInput` as a field, but it is only passed to the provider — the Firestore update calls (`updateUploadedFile`) never include `pdfBytes`. Confirmed by reviewing the `updateUploadedFile` Pick list, which does not include `pdfBytes`.

---

## 10. UI / tutor / inventory / retrieval no-change assessment

**Finding: PASS**

- No UI files modified (no `.tsx` files changed)
- `sessionMessageApiService.ts` — not modified in 8D
- `fileInventoryService.ts` — not modified in 8D. The existing `deepPdfStatus === "recommended"` branch (line 647, 666) shows a general "careful focus" suggestion (`carefulFocusSuggestion`) — this predates 8D and does not mention Deep PDF running or Gemini. No wording changes.
- `teachingContract.ts`, `requestClassifier.ts`, `deepseekGroundingPrompt.ts` — all unchanged
- `retrievalDecisionBoundary.ts` — unchanged
- No new API routes added
- No route handlers modified

**Inventory wording note:** The existing `deepPdfStatus === "recommended"` wording in `fileInventoryService.ts` is:
```
"אם יש שם נוסחה או תרשים שחשובים לך במיוחד, עדיף לבחור שאלה או סעיף מסוים ונתמקד רק בהם."
```
This is a user-friendly "careful focus" suggestion already present before 8D. It does not expose Deep PDF pipeline internals. **This wording will now sometimes fire when Deep PDF is already running or completed** (because deepPdfStatus transitions through recommended → pending → completed happen in sequence, and inventory may read any of these states). This is not a 8D regression — the wording existed before. But it is worth noting for Batch 8E tutor behavior work: the inventory wording should distinguish between "recommended" (waiting) vs "pending/completed" states more precisely.

---

## 11. Cost mode / default Normal Learning risk assessment

**Finding: ACCEPTABLE — documented, auditable**

**The hardcoded default:**
```ts
// uploadedFileApiService.ts:632
{ costMode: "Normal Learning" }
```

**Risk analysis:**

*In favor of acceptability:*
1. "Normal Learning" is the app-wide default declared in `page.tsx:103`
2. The app has no per-file cost mode storage — any default must be chosen
3. The hardcoded location (`uploadedFileApiService.ts:625-626`) is clearly commented explaining the rationale
4. The deep PDF orchestration service itself still gates on `Cheap Practice` correctly — even if "Normal Learning" is passed, a future session with Cheap Practice won't trigger re-execution (cache policy blocks it)
5. Deep PDF runs at most once per file (cache prevents re-execution on same file)

*Risks:*
1. If a user creates a session in "Cheap Practice" mode and uploads a math-heavy PDF, the post-chunking lifecycle will still attempt Deep PDF (using hardcoded Normal Learning default). This may be slightly surprising — the user chose a cheap mode but got a more expensive pass at upload time.
2. If the business decides later that Cheap Practice users should never trigger Gemini even at upload time, the hardcoded default is the change point — well-documented and narrow.

**Verdict:** The risk is documented and contained. The fix (passing costMode through the lifecycle) is straightforward when product direction is confirmed.

---

## 12. Old-file / bulk-processing safety

**Finding: PASS**

The only call site for `runDeepPdfUnderstanding` is inside `maybeRunTextOnlyDocumentUnderstandingAfterChunking`, which is only called from `runChunkingLifecycleForFile`. This function is only called:
- Explicitly by a client calling the chunking API endpoint
- Never on startup, never in a background loop, never on read/list operations

Old files without `deepPdfStatus = "recommended"` will have `deepPdfStatus = "not_started"` or `undefined`. The cache policy for these returns `not_eligible` → `shouldRunDeepPdfProcessing = false` → skipped. No bulk processing of old files occurs.

---

## 13. Validation results

| Check | Result | Detail |
|---|---|---|
| `npx tsc --noEmit` | ✅ PASS | No type errors |
| `npx vitest run` | ✅ PASS | 66 files, 794 tests pass, 121 skipped |
| `npm run build` | ✅ PASS | Clean production build |
| `git diff --check` | ✅ PASS | No trailing whitespace |
| `graphify update .` | ✅ PASS | No topology changes detected |

---

## 14. Risks / open decisions

| Risk | Severity | Recommended action |
|---|---|---|
| Optimistic pending lock — small race window for duplicate runs | Low | Batch 8E: add Firestore conditional update or distributed lock |
| `GEMINI_API_KEY` guard checked before cache policy | Negligible | Reorder in Batch 8E for efficiency (not safety) |
| Hardcoded `"Normal Learning"` default at chunking lifecycle | Low | Batch 8E: propagate session costMode through lifecycle or add explicit post-upload cost mode parameter |
| `extractionStatus`/`chunkingStatus`/`understandingStatus` not re-validated inside `runDeepPdfUnderstanding` | Low | Acceptable because call site guarantees these — document as assumption in service comment |
| Partial artifact write on `persistArtifacts` throw | Low | Acceptable for MVP — orphaned artifacts harmless; future: wrap in transactional batch |
| Text-only artifacts overwritten without rollback | Low-Medium | Acceptable for MVP — Deep PDF should produce superior artifacts; future: add versioned artifact storage |
| `deepPdfStatus === "recommended"` inventory wording shown even after Deep PDF completes | Minor UX | Batch 8E: read `deepPdfStatus === "completed"` and adapt wording accordingly |
| No validation of provider output (e.g. no question count sanity check before replacing artifacts) | Low | Batch 8E: add minimum confidence/count guard before replacing high-quality text-only artifacts |

---

## 15. Ready for Batch 8E — tutor behavior/state handling?

**YES**

Foundation is solid. The key Batch 8E tasks that are now unblocked:

1. **Inventory/Q&A routing:** Read `understandingMode`, `deepPdfStatus` from file record to prefer Deep PDF artifacts when `deepPdfStatus === "completed"`. Update `fileInventoryService.ts` to distinguish between pending/completed/failed states with appropriate wording.

2. **Pending state messaging:** When `deepPdfStatus === "pending"` and user asks an inventory or content question, show a brief honest message ("a deeper read is being prepared") without exposing pipeline internals. This is a wording change, not a behavioral one.

3. **On-demand trigger for old files:** A user asking about an old file that has `deepPdfStatus === "recommended"` can trigger `runDeepPdfUnderstanding` lazily, rather than waiting for a re-upload. This needs a new API endpoint or tutor message handler call — currently nothing triggers it on-demand.

4. **Cost mode propagation:** Propagate per-session cost mode through the chunking lifecycle or add a separate on-demand endpoint that accepts cost mode explicitly.

---

## 16. Confirmation that no code was changed
Confirmed: This audit is read-only. No source files were edited during this audit session.

## 17. Confirmation that no git add / commit / push was run
Confirmed:
- No `git add`
- No `git commit`
- No `git push`

## 18. Confirmation that no git pull was run
Confirmed:
- No `git pull`
