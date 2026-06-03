# Workspace Cleanup Batch 9E — Deleted File Exclusion Audit

## 1. Branch / HEAD
- Branch: `repair/workspace-cleanup-fit-check`
- HEAD: `fa98007 feat: add soft delete for uploaded files`

## 2. Working tree status before audit
- Clean (`git status --short` returned no changes before this audit report was written)

## 3. Recent commits checked
- `fa98007 feat: add soft delete for uploaded files`
- `f10a366 feat: add soft delete for conversations`
- `544b868 feat: add conversation rename support`
- `3530def docs: add workspace cleanup fit check`
- `e2b96fe fix: extend session message timeout for grounded responses`
- `70cc3d7 docs: add session message timeout diagnostic`
- `0316223 fix: improve tutor behavior for Deep PDF states`
- `1e14d1a fix: respect cost mode for Deep PDF auto-run`
- `04a6c47 docs: add post 8D Deep PDF runtime safety audit`
- `8b2d595 feat: add Deep PDF cache metadata policy`
- `e0cdd64 docs: add Deep PDF runtime and tutor behavior fit check`
- `4bf7365 docs: add PDF reading runtime validation report`
- `e07da8e feat: add artifact-aware question grounding`
- `cb52655 fix: make file inventory response conversational`
- `d1e8019 fix: tighten artifact inventory quality filtering`

## 4. Graphify commands used
- `graphify query "deleted uploaded file inventory retrieval grounding"`
- `graphify query "listUploadedFiles fileInventoryService deleted files"`
- `graphify query "fileChunkRetrievalService uploaded files isDeleted"`
- `graphify query "sessionMessageApiService artifact grounding uploaded files"`
- `graphify query "deepPdfOrchestrationService getUploadedFile deleted file"`
- `graphify query "extract chunks embeddings route getUploadedFile deleted"`

## 5. Reports and source files inspected
### Reports
- `AGENTS.md`
- `AGENT_TASK_PROTOCOL.md`
- `agent-memory/PROJECT_STATE.md`
- `agent-memory/CURRENT_TASK.md`
- `agent-memory/WORKSPACE_CLEANUP_BATCH_9A_FIT_CHECK.md`
- `agent-memory/WORKSPACE_CLEANUP_BATCH_9D_SOFT_DELETE_UPLOADED_FILE_REPORT.md`
- `agent-memory/WORKSPACE_CLEANUP_BATCH_9D1_BOUNDARY_VERIFICATION_REPORT.md`

### Runtime/source paths
- `src/server/workspaces/uploadedFileRepository.ts`
- `src/server/tutor/fileInventoryService.ts`
- `src/server/workspaces/fileChunkRetrievalService.ts`
- `src/server/workspaces/sessionMessageApiService.ts`
- `src/server/tutor/deepseekGroundingPrompt.ts`
- `src/server/workspaces/deepPdfOrchestrationService.ts`
- `src/server/workspaces/uploadedFileApiService.ts`
- `src/server/workspaces/fileChunkEmbeddingService.ts`
- `src/server/workspaces/documentUnderstandingOrchestrationService.ts`
- `src/app/api/workspaces/[workspaceId]/files/route.ts`
- `src/app/api/workspaces/[workspaceId]/files/[fileId]/route.ts`
- `src/app/api/workspaces/[workspaceId]/files/[fileId]/extract/route.ts`
- `src/app/api/workspaces/[workspaceId]/files/[fileId]/chunks/route.ts`
- `src/app/api/workspaces/[workspaceId]/files/[fileId]/embeddings/route.ts`
- `src/app/page.tsx`
- `src/components/files/FilePanel.tsx`

## 6. Audit findings by path

### FilePanel
**Status: PASS**
- `page.tsx` loads files only through `fetchWorkspaceFiles(...)`.
- `GET /api/workspaces/[workspaceId]/files` calls `uploadedFileApiService.listFilesForWorkspace(...)`.
- That service delegates to `uploadedFileRepository.listUploadedFiles(...)`.
- `listUploadedFiles(...)` filters with `data.isDeleted !== true`, so deleted files never reach client state or `FilePanel` in normal flow.

### Inventory
**Status: PASS**
- The `file_content_inventory` shortcut in `sessionMessageApiService.ts` starts from `repositories.listUploadedFiles(userId, workspaceId)`.
- Because the repository list already excludes deleted files, deleted files cannot become the `readyFile` used for:
  - artifact-aware inventory
  - chunk-based fallback inventory
- No separate inventory formatter path bypasses the uploaded-file filter.

### Retrieval
**Status: PASS**
- `retrieveRelevantFileChunks(...)` in `fileChunkRetrievalService.ts` starts from `deps.listUploadedFiles(userId, workspaceId)`.
- Eligible files are computed only from that filtered list.
- Old chunks for deleted files may still exist physically, but they are not reached in normal retrieval because the file must first survive the uploaded-file list filter.

### Artifact-aware grounding
**Status: PASS**
- `buildArtifactAwareGroundingContext(...)` → `maybeBuildArtifactAwareGroundingInstruction(...)` in `sessionMessageApiService.ts` first loads `uploadedFiles = await repositories.listUploadedFiles(userId, workspaceId)`.
- Candidate files for page/question hints are then filtered to retrieved file IDs and `understandingStatus === "completed"`.
- Since deleted files never enter `uploadedFiles`, their document artifacts are excluded from grounding in normal flow.

### Tutor context
**Status: PASS**
- Normal tutor grounding still depends on retrieved chunks.
- Retrieved chunks depend on `listUploadedFiles(...)`.
- Inventory and file-access shortcuts also depend on `listUploadedFiles(...)`.
- Result: deleted files are excluded from normal tutor-facing file context.

### Direct file operations (`extract` / `chunks` / `embeddings`)
**Status: PASS**
- `extract` route calls `uploadedFileApiService.runExtractionLifecycleForFile(...)`.
- `chunks` route calls `uploadedFileApiService.runChunkingLifecycleForFile(...)`.
- Both services begin with `repositories.getUploadedFile(...)`, which returns `null` when `data.isDeleted === true`.
- `embeddings` route calls `fileChunkEmbeddingService.runEmbeddingLifecycleForFile(...)`, which also begins with `deps.getUploadedFile(...)` and returns `file_not_found` for deleted files.
- So deleted files are blocked from all three direct lifecycle routes.

### Deep PDF orchestration
**Status: PASS**
- `deepPdfOrchestrationService.runDeepPdfUnderstanding(...)` begins with `deps.getUploadedFile(userId, fileId)`.
- Since `getUploadedFile(...)` returns `null` for deleted files, the orchestration exits with `file_not_found` / failed-safe behavior before reading bytes or touching artifacts.
- The post-chunking auto-run seam in `uploadedFileApiService.ts` is also safe because it can only start from a non-deleted file that already passed `getUploadedFile(...)`; if the file is deleted before the Deep PDF service runs, the orchestration service blocks it again on its own first read.

## 7. Direct chunk / artifact leak risk
### Can deleted files still be referenced by old chunks or artifacts?
**Physically: YES**
- Soft delete does not remove:
  - chunks
  - embeddings
  - document pages
  - outline
  - detected questions
  - Deep PDF artifacts

**Normal user-facing/tutor-facing runtime: NO leak found**
- All audited normal paths first gate on uploaded-file state via either:
  - `listUploadedFiles(...)`, or
  - `getUploadedFile(...)`
- Because deleted files are filtered at that boundary, old chunks/artifacts do not leak into:
  - FilePanel
  - inventory
  - retrieval
  - artifact grounding
  - direct extract/chunk/embed lifecycle routes
  - Deep PDF orchestration

### Are there code paths that query chunks/artifacts directly without first checking uploaded file state?
**Repository level: YES, but not on audited normal runtime surfaces**
- `fileChunkRepository.listFileChunks(...)`
- `documentArtifactRepository.listDocumentPages(...)`
- `documentArtifactRepository.getDocumentOutline(...)`
- `documentArtifactRepository.listDetectedQuestions(...)`
can all read by `userId` + `workspaceId/fileId` or `userId + fileId` without consulting uploaded-file state themselves.

**Runtime usage audited here:** those direct repository functions are only reached after uploaded-file state was already filtered or checked, so no current user-facing deleted-file leak was found.

## 8. Test coverage assessment
**Code behavior is safe in current audited paths, but one focused regression gap remains.**

What is already covered well:
- soft-delete repository semantics
- `listUploadedFiles(...)` deleted filter contract
- `getUploadedFile(...)` deleted filter contract
- delete route + workspace boundary behavior

What is still missing as an explicit regression:
- a focused service-level test proving a deleted file is excluded from one tutor-facing path such as:
  - retrieval, or
  - inventory, or
  - artifact-aware grounding

This is **not a proven bug** in current code, because those paths inherit the repository filter correctly.
It is a **future-refactor safety gap**, not an active runtime leak.

## 9. Fixes made
- None.
- No code bug requiring a narrow fix was found in the audited normal runtime paths.

## 10. Validation results
- `npx tsc --noEmit` — ✅ passed
- `npx vitest run` — ✅ passed (`75` files passed, `18` skipped; `947` tests passed, `121` skipped)
- `npm run build` — ✅ passed
- `git diff --check` — ✅ passed
- `graphify update .` — ✅ passed

## 11. Risks / open decisions
- Soft-deleted files still retain chunks, embeddings, and document artifacts physically. That is expected in 9D/9E, but it means future direct repository usage must continue respecting uploaded-file state boundaries.
- The biggest remaining risk is not current behavior — it is a future refactor that might query chunks/artifacts directly without first checking the uploaded-file record.
- A small follow-up regression test for one tutor-facing deleted-file path would strengthen this boundary without changing behavior.

## 12. Manual smoke checklist for Nevo
1. Delete one uploaded file from a workspace that still has another active file.
2. Refresh the page and confirm the deleted file does not return to `FilePanel`.
3. Ask `איזה קבצים העליתי לסביבת העבודה הזאת ומה יש בהם?` and confirm the deleted file is not listed.
4. Ask a question that should retrieve from the remaining active file and confirm grounding still works.
5. Try to continue processing a deleted file via stale UI state or direct API call and confirm it returns not-found.
6. If Deep PDF was previously completed for a file, delete that file and confirm no later tutor flow references it.

## 13. Clear answer
**Ready for Batch 9F or next phase: YES**

Deleted uploaded files are excluded from all audited normal user-facing and tutor-facing paths.
No active deleted-file leak was found in FilePanel, inventory, retrieval, artifact grounding, tutor context, direct lifecycle routes, or Deep PDF orchestration.

## 14. Safety confirmations
- I did not change code during the audit.
- I did not hard delete anything.
- I did not delete Storage objects.
- I did not delete Firestore records.
- I did not delete chunks.
- I did not delete embeddings.
- I did not delete document artifacts.
- I did not delete Deep PDF artifacts.
- I did not run `git add`.
- I did not run `git commit`.
- I did not run `git push`.
- I did not run `git pull`.
