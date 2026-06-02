# PDF Reading Provider Evaluation

## 1. Branch name
- `diagnostic/pdf-reading-provider-evaluation`

## 2. Working tree status
- `git status --short` was clean before this report was written.
- After writing this report, the expected working tree change is this report file only.

## 3. Current pipeline summary
Current runtime pipeline is still primarily text-first:

`upload to Firebase Storage` → `uploaded file metadata in Firestore` → `pdf-parse / mammoth extraction` → `single normalized text blob` → `character-window chunking` → `embeddings/retrieval` → `deterministic inventory / model-grounded tutor response`

The recent repairs stabilized the text-only MVP behavior, but they did not change the fundamental PDF-reading capability. For math/physics PDFs, the system is still limited by raw text extraction quality.

## 4. Current stable capabilities
- File upload is stable and preserves `storagePath` under app-managed Firebase Storage paths.
- The tutor can see uploaded files through the real session-message route.
- Hebrew uploaded-file inventory questions classify correctly.
- Inventory questions bypass the model and answer deterministically from local file/chunk state.
- Garbled math glyph soup is suppressed from inventory output.
- The tutor now honestly says it works from extracted text rather than visual PDF understanding.
- Current retrieval, Firestore, workspace, and app-managed file flow are stable enough to build on.

## 5. Current limitations
- `pdf-parse` produces weak results for formulas, page layout, diagrams, and some Hebrew math-heavy PDFs.
- Runtime does not persist page-level text, page numbers, question boundaries, or diagram anchors.
- Inventory still uses regex over chunk text rather than a true document structure layer.
- The tutor still cannot visually analyze graphs, circuits, or diagrams.
- Page-level citations are not available.
- Current deterministic inventory is useful as an MVP fallback, not a strong document-understanding layer.

## 6. Graphify commands used
- `graphify query "document extraction provider pdf parse file upload chunks"`
- `graphify query "document understanding layer pages questions formulas diagrams"`
- `graphify query "Gemini file search retrieval provider uploaded files"`
- `graphify query "visual reference request PDF page image tutor"`
- `graphify query "file inventory extraction quality math formulas"`
- `graphify query "workspace files storagePath original PDF provider boundary"`

## 7. Internal files inspected
- `agent-memory/FILE_DOCUMENT_PIPELINE_POST_REPAIR_AUDIT.md`
- `agent-memory/DOCUMENT_MATH_VISUAL_PIPELINE_DIAGNOSTIC.md`
- `agent-memory/DOCUMENT_UNDERSTANDING_STABILIZATION_BATCH_REPORT.md`
- `docs/DOCUMENT_UNDERSTANDING_LAYER.md`
- `docs/TUTOR_FILE_BEHAVIOR_MATRIX.md`
- `docs/05_Gemini_API_Integration_Spec.md`
- `docs/11_References_and_Source_Notes.md`
- `src/server/workspaces/fileExtractionProvider.ts`
- `src/server/workspaces/realDocumentExtractionProvider.ts`
- `src/server/workspaces/sessionMessageApiService.ts`
- `src/server/workspaces/uploadedFileApiService.ts`
- `src/server/workspaces/workspaceTypes.ts`
- `src/server/tutor/fileInventoryService.ts`
- `src/server/tutor/requestClassifier.ts`
- `src/lib/firebase/storageUploadClient.ts`

## 8. External official docs consulted
- Gemini document understanding: [https://ai.google.dev/gemini-api/docs/document-processing](https://ai.google.dev/gemini-api/docs/document-processing)
- Gemini Files API: [https://ai.google.dev/api/files](https://ai.google.dev/api/files)
- Gemini File Search: [https://ai.google.dev/gemini-api/docs/file-search](https://ai.google.dev/gemini-api/docs/file-search)
- Gemini pricing: [https://ai.google.dev/pricing](https://ai.google.dev/pricing)
- Gemini token counting: [https://ai.google.dev/gemini-api/docs/tokens](https://ai.google.dev/gemini-api/docs/tokens)
- Firebase AI Logic overview: [https://firebase.google.com/docs/ai-logic](https://firebase.google.com/docs/ai-logic)
- Firebase AI Logic document analysis: [https://firebase.google.com/docs/ai-logic/analyze-documents](https://firebase.google.com/docs/ai-logic/analyze-documents)
- Firebase AI Logic + Cloud Storage URLs: [https://firebase.google.com/docs/ai-logic/solutions/cloud-storage](https://firebase.google.com/docs/ai-logic/solutions/cloud-storage)
- Document AI Layout Parser: [https://cloud.google.com/document-ai/docs/layout-parse-chunk](https://cloud.google.com/document-ai/docs/layout-parse-chunk)
- Document AI OCR: [https://cloud.google.com/document-ai/docs/process-documents-ocr](https://cloud.google.com/document-ai/docs/process-documents-ocr)
- Document AI pricing: [https://cloud.google.com/document-ai/pricing](https://cloud.google.com/document-ai/pricing)
- Genkit Google GenAI integration: [https://genkit.dev/docs/go/integrations/google-genai/](https://genkit.dev/docs/go/integrations/google-genai/)

## 9. Option comparison table
| Option | Quality for Hebrew math/physics PDFs | Diagrams / figures | Page-level refs | Cost / latency | MVP difficulty | Firebase / Gemini fit | Main problems |
|---|---|---|---|---|---|---|---|
| A. Keep `pdf-parse`, improve structure only | Medium for prose, low-medium for formulas | No real visual understanding | Yes, if we add page records | Cheapest, fastest | Low-medium | Excellent | Does not materially solve diagram/formula understanding |
| B. Gemini native PDF understanding | High potential for mixed text + visual PDF understanding | Yes | Yes, if we persist page anchors from outputs / prompts | Higher per-use cost and latency than plain extraction | Medium | Strong, especially with Gemini-first architecture | Needs careful gating, source/page persistence, and privacy handling |
| C. Document AI / OCR-oriented pipeline | Strong for OCR/layout extraction, weaker fit for conceptual tutoring alone | Limited by OCR/layout focus; not a tutoring model | Yes | Extra product cost and integration complexity | High | Partial | Feels overbuilt for MVP unless scanned/OCR-heavy PDFs dominate |
| D. Hybrid pipeline (`pdf-parse` + optional Gemini deep mode) | Best balance | Yes when deep mode is used | Yes | Cheap default, expensive only when needed | Medium | Best fit | Requires a quality-gating policy and dual-path tests |
| E. Local/open-source tools | Some niche gains possible, but no clear winner for Hebrew math PDF understanding in this stack | Usually weak unless building a heavy pipeline | Maybe | Cheap infra, high engineering/debug cost | Medium-high | Weak-moderate | Likely creates complexity without solving the real visual/math problem |

## 10. Recommended architecture
**Recommended architecture: Option D — Hybrid pipeline.**

Keep the current text-first pipeline as the default, but add an explicit **Deep PDF** path powered by Gemini native PDF understanding over the original stored PDF.

### Why this is the best fit
1. It preserves the already-stabilized MVP path.
2. It matches the project’s Firebase Storage + Firestore + Gemini-first direction.
3. It avoids making every turn expensive.
4. It gives a real path to diagrams, math-heavy PDFs, and page-aware answers.
5. It avoids overcommitting to OCR-heavy infrastructure before the product proves it needs it.

### Architectural shape
- **Normal mode:** keep current extraction/chunks/inventory/retrieval path.
- **Deep PDF mode:** send the original PDF to Gemini for document understanding when the text-only path is weak or the user asks for diagram/math-heavy help.
- **Persist derived structure:** store page-level and question-level artifacts in Firestore so the app owns the resulting structure, not just the prompt-response.
- **Fallback:** if deep mode is unavailable, timeouts, or confidence is low, fall back to the current text pipeline with honest limitation messaging.

## 11. MVP recommendation
### MVP decision
**Yes — keep normal mode text-first, and add a Deep PDF mode.**

### Minimal version that materially improves physics/math PDF use
The smallest version that changes user value is:
1. Keep current upload/storage/extraction/chunking/retrieval flow.
2. Add `pageCount`, `understandingStatus`, `understandingErrorCode`, `understandingUpdatedAt`, and `outlineTitle` to file metadata.
3. Add a server-side Gemini PDF understanding job that reads the original PDF from app-managed storage.
4. Use that job to produce:
   - page-level records
   - detected question/section records
   - extraction-quality / understanding-quality metadata
5. Route only clearly weak cases into Deep PDF mode first:
   - visual questions
   - low-quality math extraction
   - uploaded-file inventory on math-heavy files when text inventory confidence is low

That is the first version that moves the app from “honest text-only tutor” to “real PDF-aware tutor” without redesigning everything.

## 12. Deferred future architecture
Defer all of the following until after the above hybrid layer proves useful:
- OCR-first pipelines
- Document AI as the main default path
- page-image rendering for all files by default
- universal vision on every file question
- full multi-file deep document reasoning
- math reconstruction into formal LaTeX/CAS pipelines
- replacing `pdf-parse` as the default normal-mode extractor

## 13. Cost / latency / privacy notes
### Cost
- Option A is cheapest.
- Gemini native PDF understanding increases per-request or per-job cost because PDF pages are processed multimodally.
- Official Gemini docs state each PDF page is counted in the multimodal pathway and page handling is tokenized; this is materially more expensive than plain local text extraction.
- Gemini File Search is attractive for persistent Gemini-side retrieval, but it is a different retrieval architecture than the app-managed workspace model.
- Document AI has separate per-page pricing and becomes another paid subsystem.

### Latency
- Current `pdf-parse` path is fastest for local deterministic extraction.
- Deep PDF mode will be slower, especially for longer PDFs and complex structured-output jobs.
- Hybrid mode keeps normal chat fast and pays the latency only on deeper document understanding operations.

### Privacy
- Keeping app-managed originals in Firebase Storage is cleaner than duplicating raw files into Gemini Files as the primary storage layer.
- Gemini Files API is temporary, not app-managed storage.
- Using server-side access to app-managed files provides a cleaner control plane than repeatedly uploading user files from the client to a second storage system.
- For the Firebase-aligned path, using Cloud Storage-backed multimodal requests via the Firebase / Vertex flow is a stronger fit than making Gemini Files API the source of truth.

## 14. Source / page reference plan
### Representation plan
Add explicit source anchors at the document-understanding layer:
- `pageNumber`
- `pageStart` / `pageEnd`
- `sourceChunkIds`
- `questionId` / `sectionId`
- `textQuality`
- `understandingConfidence`

### User-facing citation plan
Responses should cite sources as:
- file display name
- page number(s)
- question / section label when known

Example shape:
- `פיזיקה 1 — עמוד 3 — שאלה 2`
- `מטלה 4.pdf — עמודים 5–6 — סעיף ג׳`

### Why this matters
The tutor needs page-aware citations before it needs universal OCR. For educational PDFs, “which page / which question” is the practical trust unit.

## 15. Proposed provider boundary
Add a new server-side boundary, separate from the current extraction provider:

- `DocumentUnderstandingProvider`
- Input:
  - `userId`
  - `workspaceId`
  - `fileId`
  - `storagePath`
  - `sourceType`
  - optional `fileBuffer`
  - mode: `text_outline` | `deep_pdf`
- Output:
  - `pageCount`
  - `pages[]`
  - `outline`
  - `detectedQuestions[]`
  - `qualitySignals`
  - `providerName`
  - `providerMode`

Recommended initial implementation behind that boundary:
- `PdfParseOutlineProvider` for cheap text-only structure improvements
- `GeminiPdfUnderstandingProvider` for deep PDF mode

This keeps the app from coupling business logic directly to Gemini request shapes.

## 16. Proposed data model changes, if any
Recommended minimal additions to `UploadedFileRecord`:
- `understandingStatus`
- `understandingErrorCode?`
- `understandingUpdatedAt?`
- `pageCount?`
- `detectedQuestionCount?`
- `outlineTitle?`
- `documentQuality?: "good" | "partial" | "poor"`
- `deepPdfAvailable?: boolean`

Recommended new subcollections:
- `pages`
- `documentOutline`
- `detectedQuestions`

These are already aligned with the direction documented in `docs/DOCUMENT_UNDERSTANDING_LAYER.md`.

## 17. Proposed tests
### Before implementation
1. Provider contract tests for `DocumentUnderstandingProvider`
2. Schema tests for new file metadata fields and subcollection shapes
3. Lifecycle tests for `understandingStatus` transitions
4. Service routing tests for:
   - normal text-only path
   - deep PDF mode path
   - fallback when deep mode is unavailable
5. Source citation tests for page/question labels
6. Quality-gating tests proving weak extraction escalates while clean extraction stays cheap
7. Visual-question tests proving diagram requests go to deep mode or honest fallback
8. Regression tests proving current inventory/model-bypass behavior is not broken by the new layer

### Specifically needed for the provider choice
- golden tests with Hebrew math/physics PDFs
- page-level outline accuracy checks
- question-boundary extraction checks
- diagram question benchmarks
- cost/latency smoke measurements on short, medium, and long PDFs

## 18. Clear “do next” implementation batch
**Recommended next implementation batch:**

### Batch: `Document Understanding Phase 1 — Provider Boundary + Page-aware Metadata`
Scope:
1. Add `understandingStatus` + related metadata fields to types and Firestore records.
2. Add `pages`, `documentOutline`, and `detectedQuestions` schema/types only.
3. Add `DocumentUnderstandingProvider` interface and stub wiring.
4. Implement a first provider selection layer:
   - default cheap provider path
   - placeholder deep provider path contract
5. Add quality-gating logic inputs, but keep routing behavior minimal.
6. Add tests for lifecycle, schema, and fallback behavior.

### Why this batch first
It creates the safe boundary needed to evaluate Gemini PDF understanding without immediately entangling runtime tutoring, Storage, and provider-specific payload details.

## 19. What not to implement yet
- Do not build OCR.
- Do not build Document AI as the default pipeline.
- Do not make Gemini deep PDF mode the default for all file questions.
- Do not upload all files permanently into Gemini Files API as the source of truth.
- Do not redesign retrieval around Gemini File Search yet.
- Do not add page-image generation by default.
- Do not add CAS / SymPy / mathjs.
- Do not promise formula reconstruction.
- Do not replace `pdf-parse` before measuring whether the hybrid path already solves the real pain.

## 20. Confirmation that no source code was edited
Confirmed.

This evaluation did not edit source code or tests. The only file created by this task is:
- `agent-memory/PDF_READING_PROVIDER_EVALUATION.md`

## 21. Confirmation that no git add / commit / push was run
Confirmed:
- No `git add`
- No `git commit`
- No `git push`

## 22. Confirmation that no git pull was run
Confirmed:
- No `git pull`

## Direct answers to the required architecture questions
1. **Should the MVP stay text-only for normal mode and add a Deep PDF mode?**
   - Yes.
2. **Should original PDFs be passed to Gemini directly?**
   - Yes, but only server-side and selectively for deep understanding or visual/math-heavy cases.
3. **Should Gemini Files API be used, or inline PDF bytes?**
   - Neither as the primary app-managed storage strategy. Prefer app-managed Storage references for the long-term Firebase-aligned path. Use Gemini Files API only for temporary developer-API workflows if needed.
4. **Should the app store page-level records before adding vision?**
   - Yes. This is the most important non-visual prerequisite.
5. **How should source/page references be represented?**
   - File name + page number(s) + question/section label + source chunk ids.
6. **How should the tutor decide when text extraction is too weak?**
   - Use explicit quality signals: empty/very-short extraction, garbled math detection, poor section-detection confidence, and visual-intent routing.
7. **What should happen when a user asks about diagrams?**
   - Route to deep PDF mode if available; otherwise keep the current honest visual limitation fallback.
8. **What is the minimal version that materially improves physics/math PDF use?**
   - Add page-level records + Gemini deep PDF understanding job for question/section extraction and diagram-aware answering on weak PDFs.
9. **What should be explicitly deferred?**
   - OCR, Document AI default path, full page-image pipeline, CAS, and broad retrieval redesign.
10. **What tests are needed before implementation?**
   - Provider contract tests, lifecycle tests, routing/fallback tests, golden Hebrew PDF cases, and cost/latency smoke measurements.
