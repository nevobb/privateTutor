# PDF Reading Batch 8B — Deep PDF Cache Metadata

## 1. Branch / HEAD
- Branch: `repair/deep-pdf-cache-metadata`
- HEAD: `e0cdd64`

## 2. Scope
This batch adds only the metadata and cache-decision foundation needed for future Deep PDF reuse/reprocessing safety.

It does **not**:
- connect Gemini to runtime
- run Gemini
- add Firebase Storage PDF bytes loading
- change tutor responses
- change inventory behavior
- change retrieval behavior
- change upload/extract/chunk behavior beyond additive metadata/schema handling
- migrate old files

## 3. Files changed
- `src/types/index.ts`
- `src/server/workspaces/deepPdfCachePolicy.ts`
- `src/server/workspaces/workspaceTypes.ts`
- `src/server/workspaces/uploadedFileApiSchemas.ts`
- `src/server/workspaces/uploadedFileRepository.ts`
- `src/server/workspaces/uploadedFileApiService.ts`
- `tests/server/workspaces/deepPdfCachePolicy.test.ts`
- `tests/server/workspaces/uploadedFileApiSchemas.test.ts`
- `tests/server/workspaces/uploadedFileRepository.test.ts`

## 4. Implementation
### Added metadata fields
Extended uploaded-file metadata with:
- `understandingMode?: "text_only" | "deep_pdf"`
- `deepPdfProviderName?: string`
- `deepPdfModel?: string`
- `deepPdfInputHash?: string`
- `deepPdfStorageGeneration?: string`
- `deepPdfArtifactVersion?: string`
- `deepPdfCompletedAt?: Date | null`
- `deepPdfErrorCode?: string | null`

### Added cache policy helper
Created `src/server/workspaces/deepPdfCachePolicy.ts` with:
- `CURRENT_DEEP_PDF_ARTIFACT_VERSION`
- `DEFAULT_DEEP_PDF_PROVIDER_NAME`
- `evaluateDeepPdfCacheState(...)`
- `shouldUseExistingDeepPdfResult(...)`
- `shouldRunDeepPdfProcessing(...)`

The helper gives future runtime batches one deterministic place to decide whether a Deep PDF result should be reused, skipped, retried later, or reprocessed because source/provider/version identity changed.

## 5. Metadata fields behavior
### New-record defaults
New uploaded files now default to:
- `understandingMode = "text_only"`
- `deepPdfProviderName = undefined`
- `deepPdfModel = undefined`
- `deepPdfInputHash = undefined`
- `deepPdfStorageGeneration = undefined`
- `deepPdfArtifactVersion = undefined`
- `deepPdfCompletedAt = null`
- `deepPdfErrorCode = null`

Existing Batch 1 defaults remain unchanged, including:
- `understandingStatus = "not_started"`
- `deepPdfStatus = "not_started"`

### Repository / schema preservation
The new fields now round-trip through:
- public/domain types
- workspace/server types
- API serialization/parsing
- Firestore repository create/update/read mapping

## 6. `deepPdfStatus` lifecycle support
This batch does not add new lifecycle states.
It keeps the existing lifecycle:
- `not_started`
- `recommended`
- `pending`
- `completed`
- `failed`
- `skipped`

The new cache helper interprets those states conservatively for future runtime work.

## 7. Cache decision behavior
The new helper currently distinguishes these decisions:
- `use_existing_result`
- `eligible_for_future_auto_run`
- `blocked_by_cost_mode`
- `reprocess_needed_source_changed`
- `reprocess_needed_version_changed`
- `reprocess_needed_provider_changed`
- `retry_allowed_later`
- `already_pending`
- `insufficient_identity_metadata`
- `not_eligible`

Current reuse policy:
- reuse a completed Deep PDF result only when:
  - provider/model still match expectations
  - artifact version is still current
  - and input identity still matches by `deepPdfInputHash` **or** `deepPdfStorageGeneration`
- block automatic future processing in `Cheap Practice`
- allow future eligibility only for PDFs whose quality-gate outcome requires advanced understanding in `Normal Learning` or `Deep Research`

## 8. Repeated-run prevention
This batch lays the groundwork to prevent rerunning Deep PDF on every conversation.

A completed result is treated as reusable when:
- `deepPdfStatus === "completed"`
- source identity did not change
- provider/model expectations did not change
- artifact version is still current

If key identity metadata is missing on an older completed file, the policy stays conservative and returns `insufficient_identity_metadata` instead of blindly reusing it.

## 9. Backward compatibility
- Old files remain readable with all new fields absent.
- No migration was added.
- No old files are bulk-processed.
- Legacy completed Deep PDF status without the new identity metadata is treated conservatively, not as a runtime error.
- No current tutor, inventory, retrieval, upload, extraction, or chunking path behavior was intentionally changed in this batch.

## 10. Tests
### Added
- `tests/server/workspaces/deepPdfCachePolicy.test.ts`

### Updated
- `tests/server/workspaces/uploadedFileApiSchemas.test.ts`
- `tests/server/workspaces/uploadedFileRepository.test.ts`

### Coverage added
- completed Deep PDF result is reused only when identity/version/provider still match
- source identity change requires reprocessing later
- artifact version change requires reprocessing later
- `Normal Learning` can become eligible for future auto-run
- `Cheap Practice` is blocked from auto-run
- failed Deep PDF can be retried later
- pending Deep PDF prevents duplicate processing
- old completed files with missing new identity metadata are handled conservatively
- API response serialization includes the new metadata
- repository round-trip persists the new metadata and dates correctly

## 11. Validation results
### Focused tests
- `npx vitest run tests/server/workspaces/deepPdfCachePolicy.test.ts tests/server/workspaces/uploadedFileApiSchemas.test.ts tests/server/workspaces/uploadedFileRepository.test.ts` — passed (`3` files, `20` passed, `6` skipped)

### Required validation
- `npx tsc --noEmit` — passed
- `npx vitest run` — passed (`64` files passed, `18` skipped; `728` tests passed, `121` skipped)
- `npm run build` — passed
- `git diff --check` — passed
- `graphify update .` — passed

## 12. Not implemented
Explicitly not implemented in Batch 8B:
- no Gemini runtime call path
- no Firebase Storage PDF bytes loader
- no automatic Deep PDF execution
- no tutor/UI behavior change
- no inventory behavior change
- no retrieval behavior change
- no artifact storage redesign
- no file migration/backfill

## 13. Risks / open decisions
- The exact long-term identity rule (`input hash` vs `storage generation` vs both required) still needs to be finalized before runtime execution is wired.
- `understandingMode = "text_only"` is a reasonable additive default now, but future runtime code must update it explicitly on successful Deep PDF completion.
- Older completed Deep PDF records without the new metadata are intentionally conservative; future runtime code must decide whether to reprocess them lazily or only on explicit need.
- This batch adds the decision foundation only; Batch 8C still needs the guarded runtime wiring and bytes-loader boundary.

## 14. Clear answer: Ready for Batch 8C?
- **YES**

## 15. Safety confirmations
Confirmed:
- no `git add`
- no `git commit`
- no `git push`
- no `git pull`
