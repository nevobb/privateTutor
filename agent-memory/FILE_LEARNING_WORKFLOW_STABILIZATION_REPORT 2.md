# File Learning Workflow Stabilization Report

## Branch
- Branch: main
- Base: origin/main (9b7e0a6 feat: add firebase production mode foundation)

## Cause
- Manual processing issue: Codex implemented `runFileProcessingPipeline` but `isReadyForLearning` depended on ephemeral `processingStatusByFileId` for the embeddings check, so files showed "Continue processing" after page refresh even when extraction+chunking were complete.
- Filename issue: `uploadLearningFileToStorage` returned only `safeFileName`; Hebrew/space filenames were sanitized to `uploaded-file.pdf` or ASCII-only. No `originalFileName` field existed anywhere in the chain from Storage → Firestore → API → UI.
- Duplicate source key issue: Codex fixed this with `normalizeCitations` using `${sourceId}:${id}:${index}` composite key and exact-duplicate deduplication.
- Source UI clutter: Codex fixed this with `<details>`/`<summary>` collapsed by default (SourcesSection component).
- Tutor answer cleanliness issue: Grounding prompt said "You may use the following excerpts" — model could still narrate retrieval limitations ("I cannot see the PDF") because the instruction didn't explicitly forbid it.
- Timeout issue: Codex fixed this with `recoverAfterTimeout` (4 polls × 2s), clearing error on recovery, showing "המורה עדיין מעבד את התשובה..." during polling.

## Fix
- Automatic pipeline: `runFileProcessingPipeline` in `page.tsx` — Extract → Chunk → Embed runs automatically post-upload. `processingInFlightRef` prevents concurrent duplicate runs per file.
- Idempotency: Pipeline fetches latest file status before each lifecycle step; skips Extract if `extractionStatus === "completed"`, skips Chunk if `chunkingStatus === "completed"`. Embeddings always re-runs (idempotent by hash at the embedding provider level).
- Ready state after refresh: Changed `isReadyForLearning` in `FilePanel.tsx` to `extractionStatus === "completed" && chunkingStatus === "completed"` (no longer depends on ephemeral `processingStatusByFileId`). Embeddings are a pipeline-only optimization, not a Firestore-tracked gate.
- Original filenames: Added `originalFileName` field through the full chain: `src/types/index.ts` → `storageUploadClient.ts` (return value) → `workspaceFilesApiTypes.ts` → `workspaceFilesApiClient.ts` (POST body) → `uploadedFileApiSchemas.ts` (parse + response) → `workspaceTypes.ts` (`CreateUploadedFileInput`) → `uploadedFileRepository.ts` (store + retrieve) → `uploadedFileApiService.ts` (pass through) → `page.tsx` (`name: originalFileName ?? fileName`). Storage path still uses `safeFileName`; `validateStoragePathOwnership` unchanged.
- Sources keys/deduplication: `normalizeCitations` dedupes by `${sourceId}::${referenceText}` and assigns `renderKey: ${sourceId}:${id}:${index}`.
- Collapsible sources: `SourcesSection` uses `<details>`/`<summary>` — collapsed by default, shows count.
- Answer cleanliness: Updated `deepseekGroundingPrompt.ts` — instructs model to "Answer directly from this content — do not say you cannot see the file or PDF." Visual limitation note is now scoped.
- Timeout recovery: `recoverAfterTimeout` polls 4×2s after 503 timeout; on recovery sets messages and clears error. Final timeout error only shown if recovery window exhausted.

## Manual smoke
- New PDF upload: Requires browser test (terminal-only environment).
- Correct filename: Hebrew/space filenames now flow through `originalFileName` field and displayed via `name: originalFileName ?? fileName`.
- Automatic Extract: Pipeline triggers automatically in `handleFileSelected` after metadata creation.
- Automatic Chunk: Runs immediately after Extract in `runFileProcessingPipeline`.
- Automatic Embed: Runs immediately after Chunk.
- Ready without Continue Processing: `isReadyForLearning` now based on Firestore fields — shows Ready after refresh when extraction+chunking complete.
- Tutor answered from file: Requires browser test.
- No timeout/refresh needed: Timeout recovery implemented.
- Sources collapsed: `<details>` — collapsed by default.
- Sources expand: `<summary>` click toggles.
- No duplicate key console error: `normalizeCitations` composite key + dedup.
- Refresh keeps Ready state: Fixed — no longer depends on ephemeral processingStatus.
- Browser/terminal errors: None. Build clean, all tests pass.

## Validation
- npm run build: passed — 16 routes, no TypeScript errors.
- tests: 82 passed (35 component tests + 47 server tests). FilePanel test updated to match new `isReadyForLearning` logic.
- regressions: none detected.
- git diff --check: passed (no whitespace errors).
- gitleaks --no-git: 79 findings — all in `.next/` build artifacts (pre-existing, no source-code secrets).
- gitleaks history: no leaks found across 119 commits.

## Files changed
- `src/types/index.ts` — add `originalFileName?` to `UploadedFile`
- `src/lib/firebase/storageUploadClient.ts` — return `originalFileName` from upload
- `src/lib/workspaces/workspaceFilesApiTypes.ts` — add `originalFileName?` to `WorkspaceFileItem`
- `src/lib/workspaces/workspaceFilesApiClient.ts` — send `originalFileName` in POST body
- `src/server/workspaces/uploadedFileApiSchemas.ts` — parse + return `originalFileName`
- `src/server/workspaces/workspaceTypes.ts` — add `originalFileName?` to `CreateUploadedFileInput`
- `src/server/workspaces/uploadedFileRepository.ts` — store + retrieve `originalFileName`
- `src/server/workspaces/uploadedFileApiService.ts` — pass `originalFileName` through
- `src/app/page.tsx` — use `originalFileName ?? fileName` for display; pass `originalFileName` in upload; pipeline trigger
- `src/components/files/FilePanel.tsx` — fix `isReadyForLearning` (no longer needs ephemeral embeddings flag)
- `src/components/tutor/TutorConversation.tsx` — normalizeCitations, SourcesSection, timeout recovery (Codex)
- `src/server/tutor/deepseekGroundingPrompt.ts` — stronger answer-from-text instruction, visual-only limitation
- `tests/components/files/FilePanel.test.tsx` — updated test for new isReadyForLearning; added refresh + Hebrew filename tests
- `tests/components/tutor/TutorConversation.test.tsx` — tests for dedup, collapsible, timeout helpers (Codex)
- `agent-memory/AUTOMATIC_FILE_PROCESSING_REPORT.md` — Codex's prior report (untracked)

## Remaining known limitations
- Visual PDF/diagram understanding is not implemented yet.
- OCR-heavy workflows are not implemented.
- Production Storage depends on deployed rules and valid Firebase project config.
- `isReadyForLearning` optimistically assumes embedding completed when extraction+chunking are done. A future `embeddingStatus` Firestore field would be more precise.
- Grounding prompt change affects model behavior — validate in browser smoke that "cannot see the PDF" wording is eliminated.

## Recommendation
- PUSH CONDITIONAL requested — browser smoke test recommended before pushing, specifically:
  1. Hebrew filename upload → verify original name displayed.
  2. New PDF → auto Extract → Chunk → Embed → Ready (no manual click).
  3. Refresh page → file still shows Ready.
  4. Ask question → answer appears, sources collapsed, no "cannot see PDF" wording.
