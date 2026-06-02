# File Processing Persistence Repair Report

## 1. Branch name
`repair/persist-file-processing-state`

## 2. Starting issue
`FilePanel` and `page.tsx` still depended on `pendingFilesByFileId` for one important continuation path: if a file had not finished extraction before refresh, clicking `Continue processing` could fail immediately with `Re-upload required to continue processing.` even when the uploaded-file record already existed and the backend had enough persisted metadata (`fileId`, `workspaceId`, `storagePath`, statuses) to continue.

The result was an unreliable learning flow after refresh:
- newly uploaded files were still listed after reload
- but continuation could still be blocked by lost in-memory `File` state
- and the UI could imply continuation was possible even when persisted metadata was actually incomplete

## 3. Graphify commands used
- `graphify query "pendingFilesByFileId Continue processing FilePanel upload processing state"`
- `graphify query "FilePanel pendingFilesByFileId continue processing extraction chunking embedding"`
- `graphify query "workspaceFilesApiClient uploadedFileApiService file processing workflow"`
- `graphify query "createWorkspaceFileExtractPostHandler fileId extraction route FilePanel"`
- `graphify update .`

## 4. Files inspected
- `AGENTS.md`
- `AGENT_TASK_PROTOCOL.md`
- `agent-memory/PROJECT_STATE.md`
- `agent-memory/CURRENT_TASK.md`
- `agent-memory/DUAL_AGENT_SYNC_LOG.md`
- `agent-memory/RECOVERY_AUDIT_REPORT.md`
- `agent-memory/FILE_INVENTORY_WIRING_REPAIR_REPORT.md`
- `agent-memory/LEGACY_RETRIEVAL_PLACEHOLDER_REPAIR_REPORT.md`
- `agent-memory/SOURCES_CONTEXT_STATE_REPAIR_REPORT.md`
- `src/components/files/FilePanel.tsx`
- `tests/components/files/FilePanel.test.tsx`
- `src/lib/workspaces/workspaceFilesApiClient.ts`
- `tests/lib/workspaces/workspaceFilesApiClient.test.ts`
- `src/lib/workspaces/workspaceFilesApiTypes.ts`
- `src/types/index.ts`
- `src/app/page.tsx`
- `src/app/api/workspaces/[workspaceId]/files/[fileId]/extract/route.ts`
- `tests/server/workspaces/workspaceFileExtractionApiRoute.test.ts`
- `src/server/workspaces/uploadedFileApiService.ts`
- `src/server/workspaces/uploadedFileRepository.ts`
- `src/server/workspaces/fileExtractionProvider.ts`
- `src/server/workspaces/realDocumentExtractionProvider.ts`
- `tests/behavior/mvpFileLearningPipeline.test.ts`

## 5. Files changed
- `src/app/api/workspaces/[workspaceId]/files/[fileId]/extract/route.ts`
- `src/app/page.tsx`
- `src/components/files/FilePanel.tsx`
- `src/lib/workspaces/workspaceFilesApiClient.ts`
- `tests/components/files/FilePanel.test.tsx`
- `tests/lib/workspaces/workspaceFilesApiClient.test.ts`
- `tests/server/workspaces/workspaceFileExtractionApiRoute.test.ts`

## 6. Exact implementation summary
1. `src/lib/workspaces/workspaceFilesApiClient.ts`
   - Changed `runWorkspaceFileExtraction(...)` so `file` is optional.
   - When a local `File` exists, the client still sends multipart `FormData` exactly as before.
   - When the local `File` is gone after refresh, the client now sends the same persisted extract route as a plain authenticated `POST` with no multipart body.

2. `src/app/api/workspaces/[workspaceId]/files/[fileId]/extract/route.ts`
   - Removed the hard 400 gate that rejected extraction requests with no multipart file bytes.
   - The route now forwards both cases to `uploadedFileApiService.runExtractionLifecycleForFile(...)`:
     - `Buffer` present when the browser still has the file
     - `undefined` when continuation is happening from persisted state only

3. `src/app/page.tsx`
   - Removed the early client-side `Re-upload required to continue processing.` short-circuit in `runFileProcessingPipeline(...)`.
   - The page now attempts extraction through the persisted server route even when `pendingFilesByFileId[fileId]` is missing.
   - `pendingFilesByFileId` remains only for immediate upload UX and multipart extraction when a just-selected local file is still available.

4. `src/components/files/FilePanel.tsx`
   - Added `Emb:<status>` to the visible persisted status strip so file readiness is derived from all three lifecycle stages, not only extraction/chunking.
   - Updated primary-action logic to consider persisted storage availability.
   - If extraction is incomplete and `storagePath` is missing, the UI now shows a disabled `Re-upload required` action instead of pretending continuation is available.
   - Failed embedding status now participates in retry-state detection.

## 7. How refresh/reload no longer breaks processing
After refresh, `pendingFilesByFileId` may still be empty, but continuation no longer stops there.

New path after refresh:
- UI reloads `uploadedFiles` from persisted uploaded-file records
- `handleContinueProcessing(fileId)` still calls `runFileProcessingPipeline(...)`
- if extraction is incomplete, the client now calls `POST /api/workspaces/{workspaceId}/files/{fileId}/extract` even without a browser `File`
- the extract route forwards that persisted request to `uploadedFileApiService`
- if the backend can continue from persisted metadata/state, processing resumes by `fileId` instead of failing just because React memory was lost

This removes the old dependency where post-refresh continuation required the original in-memory browser `File` object.

## 8. What happens when continuation is possible
- If extraction already completed before refresh, continuation still resumes chunking and/or embeddings from persisted uploaded-file status.
- If extraction is not completed but the uploaded-file record still has persisted server metadata (`storagePath` etc.), the client now uses the persisted extract route instead of blocking on missing React state.
- Existing upload behavior for a newly selected local file is preserved: multipart extraction still runs when the browser `File` is available.

## 9. What happens when continuation is impossible
- If extraction is incomplete and the persisted uploaded-file record has no `storagePath`, `FilePanel` now shows a disabled `Re-upload required` action.
- This means the UI no longer pretends continuation is possible when required persisted metadata is actually missing.
- If the backend rejects a continuation step for another persisted-state reason, the API error still surfaces through `fileProcessingStatusById` instead of silently doing nothing.

## 10. Tests added/updated
### Added/updated in `tests/lib/workspaces/workspaceFilesApiClient.test.ts`
- Added test proving `runWorkspaceFileExtraction(...)` can call the persisted-file extract route without multipart file bytes after refresh.

### Added/updated in `tests/server/workspaces/workspaceFileExtractionApiRoute.test.ts`
- Replaced the old “missing file bytes must 400” assumption with a test proving the route now accepts persisted extraction continuation without multipart data and forwards `undefined` file bytes to the service.

### Added/updated in `tests/components/files/FilePanel.test.tsx`
- Added test proving impossible continuation is rendered clearly as `Re-upload required` when persisted storage metadata is missing.
- Added test proving embedding status is visible in the persisted file state strip.
- Existing action tests continue to prove:
  - uploaded files render after refresh from persisted status
  - persisted completed states still show `Ready for learning`
  - persisted incomplete states still show the correct primary action

### Existing targeted behavior regression still validated
- `tests/behavior/mvpFileLearningPipeline.test.ts` still passes, confirming the broader file-learning pipeline behavior remains intact.

## 11. Exact validation commands and results
### Required targeted tests
- `npx vitest run tests/components/files/FilePanel.test.tsx tests/lib/workspaces/workspaceFilesApiClient.test.ts tests/behavior/mvpFileLearningPipeline.test.ts tests/server/workspaces/workspaceFileExtractionApiRoute.test.ts`
  - Passed: `4` files, `38` tests

### Required full validation
- `npx tsc --noEmit`
  - Passed
- `npx vitest run`
  - Passed: `59` test files passed, `17` skipped; `575` tests passed, `116` skipped

### Additional repo checks
- `git diff --check`
  - Passed
- `npm run build`
  - Passed
- `npm run lint`
  - Failed on pre-existing repo lint issues unrelated to this repair scope:
    - `react-hooks/set-state-in-effect` errors already present in `src/app/page.tsx`
    - existing warnings in unrelated files/tests
- `graphify update .`
  - Passed; graph rebuilt successfully

## 12. What was intentionally not fixed
- No redesign of the upload system
- No retrieval/tutor behavior changes
- No auth/emulator plumbing changes
- No Graphify/Codex/Claude tooling file changes
- No localStorage/sessionStorage persistence of browser `File` objects
- No changes to tutor response logic, retrieval scoring, or embeddings provider behavior
- No attempt to solve other recovery-audit items outside this persistence continuation path

## 13. Remaining risks
- When the browser `File` is gone, continuation now depends on what the backend can do from persisted metadata. In this repo’s current architecture that is correct, but it is still bounded by backend extraction capabilities.
- `embeddingStatus` is now visible and used in action logic, but uploaded-file level embedding state still does not expose an explicit persisted `pending` status.
- `npm run lint` is not fully clean because of existing repo lint issues outside this repair.

## 14. Confirmation that no git add / commit / push was run
Confirmed:
- No `git add`
- No `git commit`
- No `git push`
- No `git pull`
