# PDF Reading Batch 6A — Runtime Integration Fit Check

## 1. Branch name and HEAD commit
- Branch: `repair/gemini-deep-pdf-provider`
- HEAD: `7e04507 docs: add post batch 5 provider isolation audit`

## 2. Current runtime flow summary
Current runtime file-learning flow is:
1. client uploads file bytes to Firebase Storage from `src/lib/firebase/storageUploadClient.ts`
2. client creates uploaded-file metadata through `workspaceFilesApiClient.createWorkspaceFileMetadata(...)`
3. `page.tsx` starts the processing pipeline automatically via `runFileProcessingPipeline(...)`
4. `runWorkspaceFileExtraction(...)` calls `/api/workspaces/[workspaceId]/files/[fileId]/extract`
5. `uploadedFileApiService.runExtractionLifecycleForFile(...)` writes extracted text metadata
6. `runWorkspaceFileChunking(...)` calls `/api/workspaces/[workspaceId]/files/[fileId]/chunks`
7. `uploadedFileApiService.runChunkingLifecycleForFile(...)` writes chunk metadata
8. `runWorkspaceFileEmbeddings(...)` calls `/api/workspaces/[workspaceId]/files/[fileId]/embeddings`
9. later tutor/runtime paths still use:
   - chunk inventory shortcut for `file_content_inventory`
   - chunk retrieval / semantic retrieval for tutor answers

Document understanding is currently **not** in this runtime path.

## 3. Safest integration point
### Recommended runtime hook for Batch 6B
**After chunking completes successfully, before or independent of embeddings completion.**

### Why this is the safest point
- `runChunkingLifecycleForFile(...)` already enforces:
  - workspace/file ownership
  - `extractionStatus === "completed"`
  - non-empty extracted text
  - duplicate `pending` blocking
- By the time chunking completes, all text-only inputs needed by `PdfParseOutlineProvider` already exist:
  - `extractedText`
  - `extractedTextCharCount`
  - uploaded-file metadata
  - stable file identity
- This keeps Batch 6B text-only and avoids coupling understanding to embeddings success.
- It also avoids making tutor runtime wait on understanding.

### Exact candidate boundary
- Primary candidate: `src/server/workspaces/uploadedFileApiService.ts` immediately after successful `chunking_completed` metadata update in `runChunkingLifecycleForFile(...)`.
- Safer structure: invoke a **best-effort side lifecycle** from service-layer code after chunking success, but do not make chunking fail if understanding fails.

## 4. Required guards
### Before running text-only understanding
Batch 6B should require all of the following:
- `sourceType` is `pdf` or `docx`
- `extractionStatus === "completed"`
- `chunkingStatus === "completed"`
- `extractedText` exists and is non-empty
- `understandingStatus !== "pending"`
- `understandingStatus !== "completed"` unless explicit retry policy is invoked later
- file belongs to the requested workspace/user

### Retry / failure policy
- Allow retry only when `understandingStatus === "failed"`
- Do not retry automatically in the same request loop more than once
- Do not let understanding failure regress chunking/extraction status
- Old files with missing `understandingStatus` should be treated like legacy `not_started`, but only when they pass all other extraction/chunking guards

### Duplicate-call protection
- Reuse `understandingStatus: "pending"` as the primary duplicate guard
- Batch 6B should not add client polling logic or frontend dedupe as the first line of defense
- Service-level idempotency matters more than frontend sequencing

## 5. Recommended Batch 6B scope
### Small safe scope
Batch 6B should implement **text-only runtime integration only**:
- call `documentUnderstandingOrchestrationService.runTextOnlyUnderstanding(...)`
- only from the post-chunking success path
- only for eligible files that pass the guards above
- best-effort only: chunking success must still return success even if understanding fails
- no Gemini provider execution
- no Storage PDF loading
- no tutor/runtime consumption of artifacts yet
- no UI changes

### What Batch 6B should explicitly do
- wire the orchestration service into `uploadedFileApiService` only
- update uploaded-file metadata through the existing orchestration path
- persist pages / outline / detectedQuestions through the existing repository
- optionally write a decision log entry for understanding requested/completed/failed if needed for observability

### What Batch 6B should explicitly not do
- no `GeminiPdfUnderstandingProvider`
- no quality-gate-triggered execution
- no inventory replacement
- no retrieval replacement
- no tutor artifact grounding
- no source-reference UI

## 6. How quality gate should be used
### Batch 6B usage
- Run `evaluateDocumentQualityGate(...)` **after** `runTextOnlyUnderstanding(...)` completes successfully.
- Use it to update file-level metadata / recommendation state only.
- Do **not** execute Gemini from the gate.

### Practical output handling for 6B
The gate should be used to derive:
- whether the text-only understanding result looks sufficient
- whether advanced/deep understanding is recommended for later
- whether `deepPdfStatus` should move to a recommendation state

### What not to do yet
- do not call `GeminiPdfUnderstandingProvider`
- do not surface gate output in the UI yet
- do not change tutor responses based on gate output yet

## 7. Metadata/state needs
### Existing fields that should be updated after text-only understanding
Already supported and sufficient for 6B:
- `understandingStatus`
- `understandingErrorCode`
- `understandingUpdatedAt`
- `pageCount`
- `outlineTitle`
- `detectedQuestionCount`
- `extractionQuality`

### `deepPdfStatus`
Existing enum is already sufficient for the near-term recommendation state because it includes:
- `not_started`
- `recommended`
- `pending`
- `completed`
- `failed`
- `skipped`

### Recommendation
- **No additive enum state is required for Batch 6B.**
- Safest mapping later:
  - gate recommends advanced understanding → `deepPdfStatus = "recommended"`
  - no recommendation yet → keep `deepPdfStatus = "not_started"`

## 8. Firebase Storage PDF bytes loading recommendation
### Existing helpers found
- Client-side upload helper exists in `src/lib/firebase/storageUploadClient.ts`
- Validation/ownership of `storagePath` exists in `src/server/workspaces/uploadedFileApiService.ts`
- `firebase-admin` app already carries `storageBucket` config in `src/server/firebase/firebaseAdminApp.ts`

### Missing piece
- There is **no existing server-side PDF download helper** for uploaded file bytes.

### Recommendation
Do not add Storage loading in Batch 6B.

Later, add a narrow server-only boundary such as:
- `PdfBytesLoader`
- implementation e.g. `firebaseStoragePdfBytesLoader`
- located under `src/server/firebase/` or `src/server/workspaces/`

### Loader responsibilities later
- validate `storagePath`
- read bytes from app-managed Firebase Storage only
- return `Uint8Array`
- no Gemini-side persistence
- no UI exposure

## 9. Tutor artifact-awareness plan
### Where tutor currently builds grounding / sources
- Grounding + retrieval flow: `src/server/workspaces/sessionMessageApiService.ts`
- Inventory shortcut generation: `src/server/tutor/fileInventoryService.ts`
- Chunk retrieval: `src/server/workspaces/fileChunkRetrievalService.ts`
- Source display is still driven by chunk-based grounding / citations in tutor/runtime paths

### Later safe adoption order
1. **Batch 6B:** create artifacts only, no tutor consumption
2. **Batch 6C:** make inventory artifact-aware when `understandingStatus === "completed"`, fallback to current chunk regex inventory
3. **Batch 6D:** allow specific file-question retrieval to consult `detectedQuestions` first, fallback to chunk retrieval
4. **Later:** use page/question source references in tutor-visible sources

### Important boundary
Do not let tutor runtime depend on artifacts until:
- artifact generation is proven stable
- fallback behavior is tested
- source/page references are trustworthy enough not to misground answers

## 10. Risks / open decisions
- The cleanest runtime hook is after chunking completion, but it should be implemented as best-effort side work rather than part of the core success contract of chunking.
- `documentUnderstandingOrchestrationService` currently exposes only `runTextOnlyUnderstanding(...)`; that is good for 6B and helps avoid accidental Gemini use.
- Current frontend pipeline in `page.tsx` already chains extraction → chunking → embeddings. Batch 6B must avoid turning this into a tighter coupled synchronous chain from the UI perspective.
- `extractionQuality` is currently reused for both raw extraction quality and understanding-derived quality signals. This is acceptable short term, but later work may want clearer distinction if semantics drift.
- Inventory comments already anticipate artifact-aware replacement in `fileInventoryService.ts`, but that should remain deferred until 6C.

## 11. Ready for Batch 6B?
- **YES**
- Reason: the codebase has a clear, small, service-layer integration point; the text-only provider and orchestration service already exist; guards are definable; and `deepPdfStatus = "recommended"` is already available without schema change.

## 12. Confirmation that no code/runtime behavior was changed
- Confirmed. This fit check changed no code and no runtime behavior.

## 13. Confirmation that no git add / commit / push was run
- Confirmed:
  - No `git add`
  - No `git commit`
  - No `git push`

## 14. Confirmation that no git pull was run
- Confirmed:
  - No `git pull`
