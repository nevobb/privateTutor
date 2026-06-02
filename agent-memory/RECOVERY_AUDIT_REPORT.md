# Recovery Audit Report

**Date:** 2026-06-02  
**Auditor:** Claude Code (read-only pass)  
**Branch:** main (behind origin/main by 8 commits)

---

## 1. Executive Summary

**Is the project stable enough to continue?**  
Conditionally yes. The core server-side pipeline logic is solid and well-structured. However there are **20+ TypeScript type errors** across test files, one **critical wiring gap** in the file awareness subsystem, and one **UX hole** where the pending file buffer is lost on page refresh. Nothing is broken in the production code paths that a user would hit immediately, but the test suite does not compile and some key behaviors are not wired.

**Biggest blocker:**  
TypeScript test suite fails to compile (`npx tsc --noEmit` exits with errors). Several test files cast modules to incompatible types after service signatures evolved. This blocks CI and obscures whether the new code is correct.

**Biggest behavioral gap:**  
`buildFileInventory()` in `fileInventoryService.ts` is a completed, tested function that extracts section headings from file chunks — but it is **never called**. The `file_content_inventory` intent in `sessionMessageApiService.ts` always returns a static Hebrew placeholder (`INVENTORY_NOT_AVAILABLE_RESPONSE`), even when extracted chunks exist. This is a silent regression from what the spec promised.

**What must not be touched yet:**  
- Do not run `git pull` (Obsidian note says 8 commits behind; unknown what they contain).  
- Do not commit the current dirty files until audit is reviewed and decisions made.  
- Do not touch `uploadedFileApiService.ts` or `sessionMessageApiService.ts` until type errors in their tests are fixed and tests are green.

---

## 2. Current Repo State

### Branch
`main` — local only, **8 commits behind `origin/main`**. No conflict details available without a pull.

### Dirty files (modified, not staged)
Source files that contain stabilization work and have not been committed:

| File | Category |
|---|---|
| `src/app/api/workspaces/[workspaceId]/files/[fileId]/embeddings/route.ts` | Embedding route |
| `src/app/page.tsx` | Upload + pipeline orchestration |
| `src/components/files/FilePanel.tsx` | Upload UI |
| `src/components/tutor/TutorConversation.tsx` | Chat UI |
| `src/lib/firebase/storageUploadClient.ts` | Firebase storage upload |
| `src/lib/workspaces/workspaceFilesApiClient.ts` | File API client |
| `src/lib/workspaces/workspaceFilesApiTypes.ts` | File API types |
| `src/server/tutor/deepseekGroundingPrompt.ts` | Grounding prompt |
| `src/server/tutor/retrievalDecisionBoundary.ts` | Retrieval decision |
| `src/server/tutor/teachingContract.ts` | Teaching contract |
| `src/server/workspaces/sessionMessageApiService.ts` | Core orchestrator |
| `src/server/workspaces/uploadedFileApiSchemas.ts` | File API schemas |
| `src/server/workspaces/uploadedFileApiService.ts` | File lifecycle service |
| `src/server/workspaces/uploadedFileRepository.ts` | File Firestore repo |
| `src/server/workspaces/workspaceTypes.ts` | Workspace types |
| `src/types/index.ts` | Shared types |
| Tests: `TutorConversation.test.tsx`, `teachingContract.test.ts`, `sessionMessageApiService.test.ts` | Modified tests |

### Untracked new files (stabilization output)
```
src/server/tutor/fileInventoryService.ts    ← exists, complete, NOT wired
src/server/tutor/requestClassifier.ts       ← exists, complete, wired
tests/server/tutor/fileInventoryService.test.ts
tests/server/tutor/requestClassifier.test.ts
tests/components/files/FilePanel.test.tsx
agent-memory/AUTOMATIC_FILE_PROCESSING_REPORT.md
agent-memory/CONVERSATION_ATTACHED_FILES_SPEC.md
agent-memory/FILE_LEARNING_WORKFLOW_STABILIZATION_REPORT.md (x2)
docs/DOCUMENT_UNDERSTANDING_LAYER.md
docs/TUTOR_FILE_BEHAVIOR_MATRIX.md
```

---

## 3. File Learning Workflow Map

### A. Upload (UI → Firebase → API)

```
User selects file (FilePanel.tsx input[type=file])
  ↓ onChange → onFileSelected prop
src/app/page.tsx → handleFileSelected()
  ↓ validateLearningFile()           [src/lib/firebase/storageUploadClient.ts]
  ↓ uploadLearningFileToStorage()    [src/lib/firebase/storageUploadClient.ts]
  ↓ createWorkspaceFileMetadata()    [src/lib/workspaces/workspaceFilesApiClient.ts]
    → POST /api/workspaces/{id}/files
      → createWorkspaceFilesPostHandler()  [src/app/api/workspaces/[id]/files/route.ts]
        → uploadedFileApiService.createFileForWorkspace()
          → createUploadedFile() → Firestore
          → indexingStatus: uploaded → indexing → indexed (metadata-only, no content)
  ↓ runFileProcessingPipeline()      [src/app/page.tsx, inline]
```

**Trigger:** `handleFileSelected` calls `runFileProcessingPipeline` automatically after metadata save. File is **not** conversation-attached (workspace-level only — spec for conversation-attached exists in agent-memory but is not wired).

### B. Processing Pipeline (client-orchestrated)

```
runFileProcessingPipeline() in page.tsx:
  1. fetchWorkspaceFiles → check extractionStatus
  2. if extraction not completed:
       runWorkspaceFileExtraction() → POST /api/.../extract
         → runExtractionLifecycleForFile()  [uploadedFileApiService.ts:329]
           → realDocumentExtractionProvider.extractText()
           → updateUploadedFile(extractionStatus: completed, extractedText: ...)
  3. if chunking not completed:
       runWorkspaceFileChunking() → POST /api/.../chunks
         → runChunkingLifecycleForFile()  [uploadedFileApiService.ts:432]
           → chunkExtractedText()  [fileChunker.ts]
           → replaceFileChunks()   [fileChunkRepository.ts]
           → updateUploadedFile(chunkingStatus: completed, chunkCount: N)
  4. runWorkspaceFileEmbeddings() → POST /api/.../embeddings
         → fileChunkEmbeddingService.runEmbeddingLifecycleForFile()
           → embeds each chunk, writes embeddingVector to Firestore
           → updateUploadedFile(embeddingStatus: completed/failed)
```

**Key behavior:** Pipeline is sequential, client-orchestrated. If user navigates away or closes browser after step 1, step 2+ will not run. `pendingFilesByFileId` in React state loses the `File` object on refresh.

### C. Tutor File Awareness (server-side)

```
sessionMessageApiService.sendMessageForUser()
  ↓ classifyTutorRequest(message)   [requestClassifier.ts]
    → intent: file_access_status | file_content_inventory | visual_reference_request
              | file_summary_request | specific_file_question | ambiguous_file_reference
              | general_tutor_question

  if intent === "file_access_status":
    → listUploadedFiles() → answer from Firestore state (no model call) ✓

  if intent === "file_content_inventory":
    → listUploadedFiles() → check if any file ready
    → return INVENTORY_NOT_AVAILABLE_RESPONSE (static placeholder)
    ⚠ NEVER calls buildFileInventory() — function exists but is not wired

  if intent === "visual_reference_request":
    → return static "not implemented" (deterministic) ✓

  else (general, summary, specific, ambiguous):
    → getMockTutorResponse() (first call, no grounding)
    → ensureRetrievalDecision() / applyWorkModeGuardrails()
    → executeRetrievalForTutorResponse()
      → retrieveFileChunks() → fileChunkRetrievalService (semantic + keyword fallback)
        OR executeLegacyIndexedFileRetrieval() (old Phase 8 path, still present)
    → if chunks found: getMockTutorResponse() again WITH groundingContext (second call)
    → appendMessage(citations)
```

### D. Retrieval Services

```
fileChunkRetrievalService.ts
  → retrieveRelevantFileChunks()
    → semantic (if embedding vectors exist): fileChunkSemanticRetrievalService.ts
    → keyword fallback: cosine similarity on text
    → returns RetrievedFileChunk[] with retrievalMethod, semanticScore (optional)

fileChunkEmbeddingService.ts
  → runEmbeddingLifecycleForFile()
    → buildDeterministicVector() OR gemini embedding provider
```

### E. Workspace/Session Isolation

```
sessionMessageApiService.sendMessageForUser():
  getWorkspace(userId, workspaceId) → 404 if not owned
  getSession(userId, workspaceId, sessionId) → 404 if not owned

Temporary Chat:
  learner_memory_update suppressed (line 294-309 in sessionMessageApiService.ts)
  retrieval still allowed (no block)
  messages still persisted to Firestore (not ephemeral)
```

### F. Tests

**Tutor/classifier tests (new, untracked):**
- `tests/server/tutor/fileInventoryService.test.ts`
- `tests/server/tutor/requestClassifier.test.ts`
- `tests/components/files/FilePanel.test.tsx`

**Existing modified tests:**
- `tests/components/tutor/TutorConversation.test.tsx`
- `tests/server/tutor/teachingContract.test.ts`
- `tests/server/workspaces/sessionMessageApiService.test.ts`

---

## 4. What Works (evidence-based)

- **Upload storage path** — `validateLearningFile` + `uploadLearningFileToStorage` exist and path validation enforces `users/{userId}/workspaces/{workspaceId}/files/{fileId}/{fileName}` format. Path traversal guard present. *(code inspection)*

- **Extraction lifecycle** — `runExtractionLifecycleForFile` uses `realDocumentExtractionProvider` when `fileBuffer` is provided AND `REAL_DOCUMENT_PARSER !== "0"`. Status transitions: `not_started → pending → completed/failed`. Error path marks `extractionStatus: "failed"` and logs to decision log. *(code inspection)*

- **Chunking lifecycle** — `runChunkingLifecycleForFile` guards on `extractionStatus === "completed"`. Deterministic chunker. Status transitions correct. *(code inspection)*

- **Embedding route** — `POST /embeddings` wired to `fileChunkEmbeddingService.runEmbeddingLifecycleForFile`. Updates `embeddingStatus` on file record (non-fatal if status write fails). *(code inspection)*

- **File-access awareness** — `classifyTutorRequest` recognizes Hebrew/English access-status phrases. `sessionMessageApiService` answers from Firestore state without calling the model. Distinguishes: no file, processing, processing_failed, ready. *(code inspection)*

- **Retrieval + grounding** — Two-pass pattern confirmed: first LLM call classifies, retrieval executes, second LLM call injects grounding context. Citations attached to `assistantMessage.citations`. *(code inspection, sessionMessageApiService.ts:274-291)*

- **Work-mode guardrails** — Practice mode scopes retrieval to topic/session. Research mode enables web search only with freshness cue. Temporary Chat blocks memory writes. *(code inspection)*

- **Original filename preservation** — `uploadedFileApiService.createFileForWorkspace` stores `originalFileName` separately from `name`. `page.tsx:reloadWorkspaceFiles` uses `item.originalFileName ?? item.fileName` for display. *(code inspection)*

- **Timeout recovery** — `TutorConversation.tsx` has `recoverAfterTimeout` with 4 retries × 2s interval. *(code inspection, TutorConversation.tsx:196)*

- **`requestClassifier.ts`** — Complete, testable, covers all 7 intents. Pattern-first, no model call. *(code inspection)*

---

## 5. What Is Broken or Suspicious

### CRITICAL

**C1. `buildFileInventory()` never called.**  
File: `src/server/workspaces/sessionMessageApiService.ts:3`  
Only `INVENTORY_NOT_AVAILABLE_RESPONSE` is imported from `fileInventoryService.ts`. When intent is `file_content_inventory` and chunks exist, the service returns the static placeholder instead of calling `buildFileInventory(fileName, chunks)`. The function in `fileInventoryService.ts:40` is complete and scans chunk text for section headings. It is never reached in production.

**C2. TypeScript compilation fails — test suite cannot run.**  
Command: `npx tsc --noEmit`  
Errors confirmed in:
- `tests/behavior/mvpFileLearningPipeline.test.ts:177` — module cast to `ServiceModule` type incompatible after `PostMessageRequest` type evolved.
- `tests/server/workspaces/sessionMessageApiService.test.ts:184,190,198` — two issues: module cast incompatible AND `webSearchProvider` mock returns `stance: string` instead of `"supports" | "conflicts" | "neutral"`.
- `tests/server/workspaces/fileChunkRetrievalService.test.ts:298,299,318,335` — test assertions on `retrievalMethod` and `semanticScore` properties that exist on source type as optional but test fixture doesn't include them.
- `tests/firebase/sessionMessagesApi.emulator.test.ts:88,89,90` — API signature mismatch on `createWorkspaceEmulatorTestEnvironment`.
- `tests/firebase/storage.rules.test.ts:14,21` — `UploadTask` not assignable to `Promise<unknown>`.
- `tests/server/workspaces/sessionApiRoute.test.ts:80,157,248` — `workMode: string` not assignable to `WorkMode`, plus stale `userId` fields.
- `tests/server/workspaces/sessionApiSchemas.test.ts`, `sessionApiService.test.ts`, `sessionMessageApiSchemas.test.ts` — module cast type incompatibilities after schema types tightened.
- `tests/server/workspaces/geminiFileChunkEmbeddingProvider.test.ts:31,49` — tuple index errors.

### HIGH

**H1. `pendingFilesByFileId` is React state — lost on page refresh.**  
File: `src/app/page.tsx:112`  
When `handleContinueProcessing` is called after a page refresh, `fileBytes` is `undefined`. The pipeline detects `effectiveExtractionStatus !== "completed"` and hits the early-return guard (`if (!fileBytes)` at `page.tsx:303-308`) that sets status to `"Re-upload required to continue processing."` This means any extraction-failed file after refresh requires full re-upload. No recovery path.

**H2. Legacy indexed-file retrieval still active as fallback.**  
File: `src/server/workspaces/sessionMessageApiService.ts:429-438`  
`executeLegacyIndexedFileRetrieval` runs when `chunkResult.eligibleFileCount === 0`. It filters on `indexingStatus === "indexed"` — the old Phase 8 metadata-only indexing status. This can silently return files that have no extracted text, using only the `summaryText` placeholder `"Summary placeholder; content extraction not enabled yet."` as the citation. The tutor would then receive a grounding context containing only the placeholder string.

**H3. Context strip in UI hardcoded.**  
File: `src/components/tutor/TutorConversation.tsx:283`  
`Sources: not connected yet` is a hardcoded string. Even when files are ready and retrieval is active, the UI never reflects actual source connection status. This misleads the user about whether file retrieval is working.

**H4. Embedding status not shown in FilePanel.**  
File: `src/components/files/FilePanel.tsx:127-129`  
`E:${extractionStatus}` and `C:${chunkingStatus}` are displayed but `embeddingStatus` is not. FilePanel computes `isReadyForLearning` using all three, but only shows two. A file stuck at embedding phase appears processed without feedback.

**H5. `fileInventoryService.buildFileInventory` wired only for section-pattern docs.**  
File: `src/server/tutor/fileInventoryService.ts:27-38`  
Hebrew patterns: שאלה, תרגיל, סעיף, מטלה. English: Question, Exercise, Problem. If the file uses paragraph numbers, colons, or other common academic formats, all sections return empty (`sections.length === 0`). User gets a generic fallback. Even if the function were wired, coverage of doc formats is partial.

### MEDIUM

**M1. No test for `runFileProcessingPipeline` at `page.tsx` level.**  
The auto-pipeline logic (extract → chunk → embed, with idempotency check at the start) exists only in `page.tsx`. No unit or integration test covers the case where pipeline starts mid-process (e.g., extraction done, chunking not done).

**M2. `fileInventoryService.ts` and `requestClassifier.ts` are untracked.**  
These files exist on disk and have tests but are not committed. If the branch is reset or the directory is re-cloned, they are gone.

**M3. `Temporary Chat` messages are persisted.**  
File: `src/server/workspaces/sessionMessageApiService.ts:294`  
Memory writes are suppressed but the session and messages are written to Firestore. If "Temporary Chat" is supposed to be ephemeral/not persistent, this is a behavioral mismatch with the spec.

**M4. `processingInFlightRef` is tab-scoped.**  
File: `src/app/page.tsx:113`  
`processingInFlightRef.current` prevents duplicate pipeline runs within a tab but not across two open tabs for the same workspace/file. Two tabs can trigger concurrent extraction for the same fileId.

**M5. `main` is 8 commits behind `origin/main`.**  
Unknown whether upstream changes conflict with local stabilization work. Cannot assess without pulling.

### LOW

**L1. `embeddingStatus` on `UploadedFile` type may not exist in old records.**  
File: `src/components/files/FilePanel.tsx:88`  
`file.embeddingStatus ?? "not_started"` — the `?? "not_started"` is correct defensive code, but old Firestore records may not have this field at all.

**L2. `REQUEST_TIMEOUT_MS = 15000` on file API client.**  
File: `src/lib/workspaces/workspaceFilesApiClient.ts:3`  
Large PDF extraction can take > 15s. If extraction exceeds timeout, client throws `WorkspaceFilesApiError` and pipeline aborts. Server-side extraction may still complete but client sees failure.

**L3. `inferConfidence` fallback is `0.61` for single-token filenames.**  
File: `src/server/workspaces/uploadedFileApiService.ts:580-589`  
A file named `exam.pdf` gets confidence 0.61 (below LOW_CONFIDENCE_THRESHOLD 0.7), setting `assignmentStatus: "needs-review"`. This is cosmetic for now but could affect future filtering.

---

## 6. Missing Tests

| Missing test | Why it matters |
|---|---|
| `file_content_inventory` intent with ready chunks returns real inventory (not placeholder) | Needed before `buildFileInventory` is wired in — would fail red now, guide fix |
| `handleContinueProcessing` when `pendingFilesByFileId` is empty (refresh case) | Current behavior shows misleading error; test pins the behavior |
| `runFileProcessingPipeline` with extraction already done (idempotency check) | Covers the re-entrant case |
| `file_access_status` distinguishes all 4 states: no files, processing, failed, ready | Partially covered by code, no dedicated test for all 4 branches |
| Two-pass grounding: second LLM call receives grounding context | Not tested in `sessionMessageApiService.test.ts` |
| Legacy indexed-file retrieval fallback is skipped when chunk retrieval returns 0 results | `executeLegacyIndexedFileRetrieval` behavior untested |
| Temporary Chat does NOT write to learner memory but DOES persist messages | Behavioral contract not tested |
| FilePanel shows "Re-upload required" status when `fileBytes` is undefined | UI behavior not tested |
| `embeddingStatus` not shown in FilePanel even when in-progress | UI gap |

---

## 7. Risk Map

| Severity | Issue |
|---|---|
| **CRITICAL** | `buildFileInventory` never called — file content inventory always returns placeholder |
| **CRITICAL** | TypeScript compilation fails — 20+ type errors — test suite cannot run |
| **HIGH** | `pendingFilesByFileId` lost on page refresh — continue-processing silently fails |
| **HIGH** | Legacy indexed-file retrieval injects placeholder text as grounding context |
| **HIGH** | Context strip hardcoded "Sources: not connected yet" — user can't tell retrieval works |
| **HIGH** | `fileInventoryService.ts` and `requestClassifier.ts` uncommitted |
| **MEDIUM** | Embedding status not shown in FilePanel |
| **MEDIUM** | Temporary Chat messages persisted (not ephemeral) |
| **MEDIUM** | 15s timeout too tight for large PDFs |
| **MEDIUM** | `processingInFlightRef` tab-scoped only |
| **MEDIUM** | main 8 commits behind origin/main |
| **LOW** | `inferConfidence` < 0.7 for short filenames sets needs-review |
| **LOW** | Old Firestore records may lack `embeddingStatus` field |

---

## 8. Recommended Repair Order

Each task is scoped for one agent execution pass.

1. **Commit `fileInventoryService.ts` and `requestClassifier.ts`** (and their tests) before any code change. These must not be lost. *(git add src/server/tutor/fileInventoryService.ts src/server/tutor/requestClassifier.ts tests/server/tutor/fileInventoryService.test.ts tests/server/tutor/requestClassifier.test.ts)*

2. **Fix TypeScript errors in test files.** Fix in this order:
   - `sessionMessageApiService.test.ts` — fix `webSearchProvider` mock `stance` to literal union; fix module cast pattern.
   - `sessionApiRoute.test.ts`, `sessionApiSchemas.test.ts`, `sessionApiService.test.ts`, `sessionMessageApiSchemas.test.ts` — update stale module cast patterns to match evolved types.
   - `fileChunkRetrievalService.test.ts` — add `retrievalMethod` and `semanticScore` to test fixture chunks.
   - `mvpFileLearningPipeline.test.ts` — update `ServiceModule` cast to match current `PostMessageRequest` shape.
   - `storage.rules.test.ts` — wrap `UploadTask` with `.then()` to satisfy `Promise<unknown>`.
   - `geminiFileChunkEmbeddingProvider.test.ts` — fix tuple index issues.
   - `sessionMessagesApi.emulator.test.ts` — update `createWorkspaceEmulatorTestEnvironment` call signature.
   - **Verify:** `npx tsc --noEmit` exits 0.

3. **Wire `buildFileInventory` into `sessionMessageApiService`** for `file_content_inventory` intent. When `hasReadyFile`, call `listFileChunks` for the ready file, call `buildFileInventory(fileName, chunks)`, and call `formatFileInventoryResponse(result)` as the response content. Fall back to `INVENTORY_NOT_AVAILABLE_RESPONSE` only if chunks are empty.

4. **Remove or guard `executeLegacyIndexedFileRetrieval`** — either delete the function or add a guard that skips it when `summaryText` equals the known placeholder string. This prevents placeholder text from being injected as grounding context.

5. **Add `embeddingStatus` label to `FilePanel`** — render `Em:${embeddingStatus}` alongside `E:` and `C:`. Low scope, high signal.

6. **Update context strip** in `TutorConversation.tsx` from `"Sources: not connected yet"` to show actual file count or retrieval state. Accept prop from page.tsx.

7. **Persist `pendingFilesByFileId` to `sessionStorage`** — on upload, write `fileId → File` to sessionStorage. On mount, read back. This survives page refresh within the same tab and session.

8. **Add missing behavioral tests** for wired `buildFileInventory`, two-pass grounding, and Temporary Chat persistence contract.

9. **Investigate `origin/main` delta** — `git fetch origin && git log HEAD..origin/main --oneline` — then assess merge safety before pulling.

---

## 9. Questions for Nevo

1. **Temporary Chat persistence:** Should Temporary Chat messages be truly ephemeral (not written to Firestore) or just memory-isolated? Current code persists them. If ephemeral is required, the `appendMessage` calls in the Temporary Chat path need a separate code path.

2. **Legacy indexed-file retrieval:** Should `executeLegacyIndexedFileRetrieval` be removed entirely, or kept as a last-resort fallback? Removing it simplifies the code but means "indexed" files with no chunks return zero results instead of a placeholder citation.

3. **File buffer loss on refresh:** Acceptable for personal use? Or should the server be able to re-fetch from Firebase Storage directly for extraction (removing the client-side file requirement for the extract step)?

4. **`origin/main` 8 commits ahead:** What do those 8 commits contain? Safe to pull now, or are they experimental branches that were merged prematurely?

---

## 10. Tool Usage Log

### Graphify commands
- `graphify query "file upload extraction chunk embedding retrieval flow"`
- `graphify query "uploadedFileApiService fileInventoryService requestClassifier TutorConversation"`
- `graphify query "sessionMessageApiService tutor orchestrator retrieval citations"`
- `graphify query "Temporary Chat workspace isolation tutor messages"`
- `graphify query "source citations file inventory no access claim"`

### Files inspected
- `agent-memory/PROJECT_STATE.md` (Obsidian snapshot)
- `package.json`
- `src/server/tutor/fileInventoryService.ts`
- `src/server/tutor/requestClassifier.ts`
- `src/server/workspaces/sessionMessageApiService.ts`
- `src/server/workspaces/uploadedFileApiService.ts`
- `src/app/api/workspaces/[workspaceId]/files/[fileId]/embeddings/route.ts`
- `src/components/files/FilePanel.tsx`
- `src/components/tutor/TutorConversation.tsx` (lines 1–399)
- `src/app/page.tsx` (lines 1–441)
- `src/lib/workspaces/workspaceFilesApiClient.ts`
- `src/server/workspaces/fileChunkRetrievalService.ts` (grep only)

### Commands run
- `git status --short`
- `git log --oneline -10`
- `git branch -vv`
- `ls tests/server/tutor/ tests/components/files/ tests/server/workspaces/`
- `npx tsc --noEmit` — **FAILED with 20+ errors** (see Section 5)
- `grep -n "buildFileInventory|fileInventoryService|shouldUseFileInventory" src/server/workspaces/sessionMessageApiService.ts`
- `grep -n "retrievalMethod|semanticScore|RetrievedFileChunk" src/server/workspaces/fileChunkRetrievalService.ts`

### Commands NOT run (no test runner invoked)
- `npm test` / `vitest` not run (test suite would fail to compile; running would add noise without signal)
- `npm run lint` not run (not a blocker for this audit)
- `npm run build` not run (Next.js build in production mode requires env vars)

---

*Report written by Claude Code. Evidence-based only. No code was modified.*
