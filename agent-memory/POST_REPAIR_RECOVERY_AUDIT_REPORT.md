# Post-Repair Recovery Audit Report

## 1. Branch name
`audit/post-repair-recovery-audit`

## 2. Validation commands and results

### Repo state
- `git branch --show-current`
  - Result: `audit/post-repair-recovery-audit`
- `git status --short`
  - Result before report write: clean

### Required validation
- `npx tsc --noEmit`
  - Result: passed
- `npx vitest run`
  - Result: passed
  - Summary: `59` test files passed, `17` skipped; `575` tests passed, `116` skipped
- `npm run build`
  - Result: passed
- `git diff --check`
  - Result: passed

### Additional audit check
- `npm run lint`
  - Result: failed
  - Failure appears pre-existing and not introduced by this audit pass.
  - Current blocking lint errors are in `src/app/page.tsx`:
    - `react-hooks/set-state-in-effect` at lines `118`, `346`, and `507`
  - Additional warnings exist in unrelated files/tests.

### Grep evidence command
- `rg -n "Sources: not connected yet|Summary placeholder; content extraction not enabled yet|Re-upload required|pendingFilesByFileId|buildFileInventory" src tests agent-memory || true`
  - Result summary:
    - Active code now contains `buildFileInventory` usage in `src/server/workspaces/sessionMessageApiService.ts`
    - Active code still contains `pendingFilesByFileId` in `src/app/page.tsx`, but not as the only continuation path
    - Active code contains `Re-upload required` only as an explicit impossible-continuation UI state in `src/components/files/FilePanel.tsx`
    - Active code does **not** contain `Sources: not connected yet`
    - `Summary placeholder; content extraction not enabled yet.` still exists in active code as a legacy placeholder constant / fixture string, but not as allowed grounding content
    - Many grep hits are historical mentions in `agent-memory/*` reports and should not be treated as active bugs

## 3. Status of each original CRITICAL/HIGH issue

### C1. `buildFileInventory()` never called
**Status:** resolved

**Evidence:**
- `src/server/workspaces/sessionMessageApiService.ts` imports `buildFileInventory` and `formatFileInventoryResponse`
- In the `file_content_inventory` branch, active code now does:
  - `listUploadedFiles(...)`
  - `listFileChunks(...)`
  - `buildFileInventory(...)`
  - `formatFileInventoryResponse(...)`
- The branch is deterministic and bypasses model calling for inventory requests
- `tests/server/workspaces/sessionMessageApiService.test.ts` includes inventory-path assertions, and the full test suite passes

### C2. TypeScript/test baseline broken
**Status:** resolved

**Evidence:**
- `npx tsc --noEmit` passes in the current branch
- `npx vitest run` passes in the current branch
- `npm run build` passes in the current branch
- The original recovery audit’s stated blocker (`20+` TypeScript errors across tests) is no longer reproducible

### H1. Continue processing after refresh depended only on `pendingFilesByFileId`
**Status:** resolved

**Evidence:**
- `src/app/page.tsx` still reads `pendingFilesByFileId[fileId]`, but `runFileProcessingPipeline(...)` no longer aborts when `fileBytes` is missing
- `src/lib/workspaces/workspaceFilesApiClient.ts` now allows `runWorkspaceFileExtraction(...)` with optional `file?: File`
- `src/app/api/workspaces/[workspaceId]/files/[fileId]/extract/route.ts` now accepts requests with no multipart body and forwards `undefined` `fileBuffer` to the extraction service
- `tests/lib/workspaces/workspaceFilesApiClient.test.ts` covers the persisted extract route without multipart bytes
- `tests/server/workspaces/workspaceFileExtractionApiRoute.test.ts` covers the route behavior without multipart bytes
- This means `pendingFilesByFileId` still exists for immediate upload UX, but it is no longer the sole post-refresh continuation dependency

### H2. Legacy placeholder retrieval could ground tutor answers / fake retrieval
**Status:** partially resolved

**Evidence:**
- `src/server/workspaces/sessionMessageApiService.ts` defines `LEGACY_SUMMARY_PLACEHOLDER = "Summary placeholder; content extraction not enabled yet."`
- Active code filters this exact placeholder out of `executeLegacyIndexedFileRetrieval(...)`
- When only placeholder summaries are present, active code sets retrieval state to `used: false` with `why = "retrieval_skipped_placeholder_content_only"`
- `tests/server/workspaces/sessionMessageApiService.test.ts` includes placeholder-skip assertions and the full suite passes

**Why only partially resolved:**
- The legacy retrieval path still exists
- The filter is an exact-string guard, so this risk is strongly reduced for known data but not structurally eliminated for arbitrary future placeholder variants
- The original audit slightly overstated “grounding context” injection; current evidence supports that the main fix blocks false retrieval/citation state for the known placeholder string

### H3. Context strip hardcoded `Sources: not connected yet`
**Status:** resolved

**Evidence:**
- Grep finds no active source/test occurrence of `Sources: not connected yet`
- `src/components/tutor/TutorConversation.tsx` now uses `formatSourcesLabel(uploadedFileCount)`
- `formatSourcesLabel(...)` returns only:
  - `No files uploaded`
  - `1 file available`
  - `N files available`
- `tests/components/tutor/TutorConversation.test.tsx` covers the new label behavior, and the full suite passes

### H4. `fileInventoryService.ts` and `requestClassifier.ts` uncommitted / untracked
**Status:** resolved

**Evidence:**
- `git ls-files` shows all four expected files are tracked:
  - `src/server/tutor/fileInventoryService.ts`
  - `src/server/tutor/requestClassifier.ts`
  - `tests/server/tutor/fileInventoryService.test.ts`
  - `tests/server/tutor/requestClassifier.test.ts`
- Current working tree was clean before this audit report file was created

## 4. Evidence notes for active vs historical mentions
- `Sources: not connected yet`
  - Active code: absent
  - Historical mentions: present in older audit/repair reports only
- `Summary placeholder; content extraction not enabled yet.`
  - Active code: still present as a placeholder constant and in some tests/fixtures
  - Active behavior: guarded in `sessionMessageApiService.ts`; not treated as automatic proof of an active bug
- `Re-upload required`
  - Active code: present intentionally in `FilePanel.tsx` for the case where persisted storage metadata is genuinely missing
  - This is now a clear impossible-continuation state, not the old premature refresh failure path
- `pendingFilesByFileId`
  - Active code: still present in `page.tsx`
  - Active behavior: no longer the only continuation path, so presence alone is not a bug
- `buildFileInventory`
  - Active code: present in both the service import and the user request flow
  - Historical mentions: still appear in prior audit reports describing the old broken state

## 5. Any remaining risks
- `npm run lint` is still not clean due to pre-existing lint errors, mainly `react-hooks/set-state-in-effect` in `src/app/page.tsx`
- `buildFileInventory` still inventories only the first ready file rather than multiple ready files
- `buildFileInventory` still depends on heading-pattern extraction, so prose-only documents will fall back honestly rather than producing rich inventory
- Legacy retrieval placeholder protection uses exact string matching, so the known placeholder is blocked but the defense is not fully generalized
- `pendingFilesByFileId` still exists for immediate upload UX, which is fine, but multi-tab duplicate-processing risk from `processingInFlightRef` being tab-scoped remains outside these completed repairs
- `TutorConversation` source label is now truthful at the file-count level, but it does not yet express finer-grained readiness like “processing” vs “ready” in the strip itself

## 6. Ready for manual workflow smoke test
**Yes.**

Why:
- compile/type baseline is clean
- automated tests are green
- build is green
- the original CRITICAL blockers are resolved
- the repaired HIGH issues are either resolved or reduced enough that a manual browser workflow is now the right next validation step

## 7. Immediate code fix required before smoke testing
**No.**

Reason:
- No currently reproduced CRITICAL/HIGH issue blocks a manual end-to-end smoke test of the file learning workflow
- The remaining issues are real but do not prevent validating upload → extract → chunk → embed → inventory/retrieval behavior manually
- `npm run lint` failure should be documented and addressed later, but it is not a blocker for smoke testing this repaired workflow

## 8. Confirmation that no source files were edited
Confirmed.

This audit did not edit any source code or tests. The only file created by this audit is:
- `agent-memory/POST_REPAIR_RECOVERY_AUDIT_REPORT.md`

## 9. Confirmation that no git add / commit / push was run
Confirmed:
- No `git add`
- No `git commit`
- No `git push`
- No `git pull`
