# Document / Math / Visual Pipeline Diagnostic

## 1. Branch name

- `diagnostic/document-understanding-math-visual-pipeline`

## 2. Working tree status

- `git status --short` was clean before this report was written.
- After writing this report, the expected working tree change is this report file only.

## 3. Smoke result being investigated

- Manual smoke now reaches the uploaded-file inventory flow correctly.
- The tutor answers with a text-only limitation disclaimer:
  - `אני עובד עם הטקסט שחולץ מהקובץ, לא עם תצוגה חזותית של ה-PDF...`
- It then surfaces visibly broken formula-like extraction output such as:
  - `0 0 1 2  a B I `
- For physics/math PDFs, this is not good enough because:
  - visual page understanding is absent
  - extracted formulas are not normalized into readable math
  - inventory output can expose noisy raw extraction previews directly

## 4. Graphify commands used

- `graphify query "PDF extraction document understanding page text math formula visual"`
- `graphify query "realDocumentExtractionProvider pdf parse extracted text layout formulas"`
- `graphify query "fileInventoryService format inventory extracted text headings math"`
- `graphify query "document understanding pages questions formulas diagrams storage"`
- `graphify query "visual reference request PDF page image tutor"`
- `graphify query "math LaTeX formatting tutor response teaching contract"`
- `graphify query "math tools calculator CAS sympy mathjs provider"`

## 5. Files inspected

- `src/lib/firebase/storageUploadClient.ts`
- `src/server/workspaces/uploadedFileApiSchemas.ts`
- `src/lib/workspaces/workspaceFilesApiTypes.ts`
- `src/server/workspaces/fileExtractionProvider.ts`
- `src/server/workspaces/realDocumentExtractionProvider.ts`
- `src/server/workspaces/uploadedFileApiService.ts`
- `src/server/workspaces/workspaceTypes.ts`
- `src/types/index.ts`
- `src/server/workspaces/uploadedFileRepository.ts`
- `src/server/workspaces/fileChunkRepository.ts`
- `src/server/workspaces/fileChunker.ts`
- `src/server/workspaces/sessionMessageApiService.ts`
- `src/server/tutor/fileInventoryService.ts`
- `src/server/tutor/requestClassifier.ts`
- `src/server/tutor/teachingContract.ts`
- `src/server/tutor/deepseekGroundingPrompt.ts`
- `src/server/tutor/providerRegistry.ts`
- `src/components/chat/MessageContent.tsx`
- `src/app/api/workspaces/[workspaceId]/files/[fileId]/extract/route.ts`
- `src/app/api/workspaces/[workspaceId]/files/[fileId]/chunks/route.ts`
- `src/app/api/workspaces/[workspaceId]/files/[fileId]/embeddings/route.ts`
- `tests/server/workspaces/realDocumentExtractionProvider.test.ts`
- `tests/server/workspaces/fileChunker.test.ts`
- `tests/server/workspaces/uploadedFileApiService.test.ts`
- `tests/server/tutor/fileInventoryService.test.ts`
- `tests/server/tutor/requestClassifier.test.ts`
- `tests/server/tutor/teachingContract.test.ts`
- `tests/components/chat/MessageContent.test.ts`
- `docs/DOCUMENT_UNDERSTANDING_LAYER.md`
- `docs/TUTOR_FILE_BEHAVIOR_MATRIX.md`
- `package.json`

## 6. Full pipeline map

### A. PDF ingestion

1. User selects a file in the browser.
2. `src/lib/firebase/storageUploadClient.ts` validates only PDF/DOCX and uploads bytes to Firebase Storage.
3. The Storage path is preserved as:
   - `users/{userId}/workspaces/{workspaceId}/files/{fileId}/{safeFileName}`
4. Returned upload metadata includes:
   - `storagePath`
   - `fileName` (sanitized storage filename)
   - `originalFileName`
   - `sizeBytes`
   - `contentType`
   - `sourceType`
5. Metadata API request to workspace files preserves only a subset:
   - `fileName`
   - `originalFileName`
   - `sourceType`
   - `storagePath`
   - `topicHint`
6. `src/server/workspaces/uploadedFileApiService.ts` persists file metadata into Firestore through `uploadedFileRepository.ts`.

### B. Extraction

1. Extraction route optionally reads multipart `file` bytes.
2. `uploadedFileApiService.runExtractionLifecycleForFile(...)` chooses:
   - real parser when `fileBuffer` exists
   - deterministic placeholder provider when `fileBuffer` does not exist
3. Real parser implementation is `src/server/workspaces/realDocumentExtractionProvider.ts`.
4. PDF parsing uses `pdf-parse`.
5. DOCX parsing uses `mammoth`.
6. Extraction output is a single normalized text blob plus parser metadata/warnings.
7. Persisted fields include:
   - `extractedText`
   - `extractedTextPreview`
   - `extractedTextCharCount`
   - `extractionSource`
   - `extractionStatus`

### C. Chunking

1. `src/server/workspaces/fileChunker.ts` chunks extracted text by character windows.
2. Chunk boundaries are based on:
   - paragraph break
   - line break
   - space break
   - otherwise raw character cutoff
3. Result chunks store:
   - text
   - chunk index
   - char range
   - token estimate
   - source = `extracted_text`
4. Chunks are persisted in Firestore under a chunks subcollection.

### D. Embedding / retrieval

1. Embeddings are generated for chunks only.
2. Optional Gemini embedding provider exists for semantic retrieval.
3. This layer helps text retrieval quality, but does not parse or repair formulas.

### E. Inventory / tutor flow

1. Tutor inventory requests route through `sessionMessageApiService.ts`.
2. `file_content_inventory` loads uploaded files, picks the first ready file, loads its chunks, then calls:
   - `buildFileInventory(...)`
   - `formatFileInventoryResponse(...)`
3. Inventory is regex-based over raw chunk text.
4. The formatted answer explicitly says the system is text-based and not visual.
5. If regex finds headings, previews are copied directly from extracted chunk text.

### F. Visual route

1. Visual questions are detected by `requestClassifier.ts`.
2. `sessionMessageApiService.ts` handles them deterministically.
3. Current behavior is a limitation message only.
4. No visual file/page/image retrieval occurs.

### G. Chat rendering

1. `MessageContent.tsx` renders Markdown + KaTeX.
2. It can display clean LaTeX well if the model outputs valid math notation.
3. It does not repair broken extraction text into LaTeX.

## 7. Evidence table

| Checkpoint | Expected capability for useful physics/math tutor | Current implemented capability | Evidence source | Status | Notes | Class |
|---|---|---|---|---|---|---|
| Upload entry | PDF enters with stable file reference | File uploads to Storage and preserves `storagePath` | code: `storageUploadClient.ts` | working | file path is preserved cleanly | A |
| Original file name | Preserve user-visible filename | `originalFileName` stored separately from safe storage name | code: upload + repository types | working | good UX foundation | A |
| MIME fidelity | Preserve exact MIME/content type in runtime metadata | content type exists at browser upload return, but not stored in uploaded-file Firestore model | code: `storageUploadClient.ts`, `uploadedFileApiSchemas.ts` | partial | runtime stores `sourceType`, not exact MIME | B |
| Page count storage | Keep page count for later page-aware retrieval | `pdf-parse` returns `numpages`, but runtime does not persist `pageCount` | code: `realDocumentExtractionProvider.ts`, docs design | missing | design exists only in docs | C |
| Page-level text model | Store per-page text | No page subcollection implemented | docs vs active code search | missing | only full-text blob exists | C |
| Formula preservation | Preserve equations/symbols cleanly from PDF | No formula extraction/repair layer | extraction code + tests | missing | only whitespace normalization exists | C |
| Hebrew RTL preservation in extraction | Preserve logical Hebrew order from PDF text | No dedicated RTL repair; relies on parser output | extraction code/tests | unknown | may work for some PDFs, not validated | F |
| Symbol survival | Keep μ, π, subscripts, fractions, equations readable | No symbol cleanup or math normalization | extraction code/tests | missing | broken symbols can pass through raw | E |
| Scanned PDF detection | Warn when text layer absent | warnings for empty/short extract and possible scanned PDF | `realDocumentExtractionProvider.ts` tests | partial | only warning generation, not full UX recovery | B |
| Chunking structure | Preserve semantic document structure | Character-window chunking only | `fileChunker.ts` | partial | respects newlines/spaces, not math/page/question structure | B |
| Page refs in chunks | Keep page anchors for later citations | No page refs in chunks | `FileChunk` / repository shape | missing | only chunk index + char range | C |
| Question boundaries | Deterministically detect question spans | Inventory uses regex over chunk text at answer time | `fileInventoryService.ts` | existing but weak | provisional best-effort only | B |
| Formula-safe inventory | Avoid dumping broken formula fragments | Inventory preview copies raw extracted text | `fileInventoryService.ts` | weak | can surface garbled math directly | E |
| Extraction quality warning in inventory | Tell user when extraction quality is limited | General text-only disclaimer exists, but no formula-quality warning | inventory formatter | partial | honest about visual limit, not extraction fidelity | G |
| Multi-file inventory | Handle all ready files when user asks broadly | Only first ready file is used | `sessionMessageApiService.ts` | weak | known limitation | B |
| Visual page understanding | Answer graph/diagram questions visually | Not implemented; deterministic refusal/fallback only | classifier + service + behavior matrix | missing | honest limitation | D |
| Page image generation/storage | Render/store page images | Not implemented in runtime | docs design vs code search | missing | Phase E only in docs | D |
| OCR | Recover text from image-only/scanned PDFs | Not implemented | docs + code/tests | missing | explicitly out of scope | D |
| Vision provider flow | Send page image to Gemini Vision or similar | No runtime Gemini Vision flow | code search + provider registry | missing | only embeddings Gemini exists | D |
| LaTeX output rendering | Show valid model math cleanly | Chat renderer supports KaTeX well | `MessageContent.tsx` tests | working | output path is ready if math is already clean | A |
| LaTeX normalization layer | Convert broken extracted math into LaTeX | None | code/tests | missing | major current gap | C |
| Math parser/CAS | Verify algebra/calculus with tools | No mathjs/SymPy/CAS/tool-call runtime | package + code search | missing | reasoning is LLM-only | D |
| Tutor contract | Require clean LaTeX and honest limitations | Contract explicitly requires clean LaTeX and visual honesty | `teachingContract.ts` + tests | working | prompt intent is good | A |
| Prompt/runtime match | Runtime should support what contract promises | Contract promises clean LaTeX, but extraction pipeline supplies noisy raw text | contract vs extraction/inventory | partial | mismatch emerges for file-derived formulas | G |
| Formula-preservation tests | Guard against broken physics/math extraction | No tests for formula fidelity through extraction/chunk/inventory | tests inspected | missing | major blind spot | F |
| Visual limitation tests | Guard truthful visual limitation behavior | Classifier/contract tests exist; no page-image flow tests because none exists | requestClassifier + teachingContract tests | partial | limitation messaging tested, capability absent | B |

## 8. Current PDF extraction capability

- Active PDF parser: `pdf-parse`
- Active DOCX parser: `mammoth`
- Extraction result shape:
  - full raw text blob
  - parser name
  - warnings for empty/short/scanned-like extraction
- Normalization is limited to:
  - CRLF normalization
  - tabs to spaces
  - repeated spaces collapse
  - repeated blank lines collapse
- What extraction does **not** do:
  - per-page storage
  - layout preservation
  - equation reconstruction
  - formula token cleanup
  - Hebrew/RTL correction
  - figure caption extraction as structured data

## 9. Current page/document model capability

- Runtime does **not** store pages.
- Runtime does **not** store page-level text.
- Runtime does **not** store question boundaries as first-class records.
- Runtime does **not** store formulas separately.
- Runtime does **not** store diagrams/images or page image references.
- Runtime does **not** store page-based citations.
- The richer model exists only in `docs/DOCUMENT_UNDERSTANDING_LAYER.md` as design.

## 10. Current visual capability

- Current visual support is **classification + honest limitation only**.
- `visual_reference_request` is recognized.
- Runtime response says visual PDF analysis is not yet implemented.
- There is no:
  - page image generation
  - image storage
  - OCR
  - vision provider call
  - page localization
  - diagram analysis

## 11. Current math formatting capability

- Output rendering capability:
  - strong for valid LaTeX
  - KaTeX is integrated in chat
- Upstream math normalization capability:
  - essentially none
- There is no logic that converts extracted garbage like:
  - `0 0 1 2  a B I `
  into:
  - clean LaTeX
  - readable unicode math
  - symbol-normalized equations
- So the system can render clean math, but it cannot produce clean math from noisy PDF extraction automatically.

## 12. Current math tools capability

- No `mathjs`
- No `sympy`
- No calculator/CAS runtime
- No tool-calling architecture for math verification
- No separation between:
  - language-model explanation
  - symbolic verification
  - numeric computation
- The only adjacent “tooling” in this area is embedding/retrieval infrastructure, which is unrelated to mathematical correctness verification.

## 13. Current tutor behavior around visual/math limitations

- The teaching contract says:
  - formulas should be written in clean LaTeX
  - visuals are not yet analyzed visually
  - uncertainty should be stated honestly
- Inventory formatter says:
  - current inventory is based on extracted text, not visual PDF structure
- Visual handler says:
  - graphs/diagrams/images are not analyzed visually yet
- Net result:
  - visual limitation is communicated honestly
  - math-quality limitation is **not** communicated specifically enough
  - raw broken extracted text can still leak into user-visible inventory previews

## 14. Exact reason the answer looked bad

The bad-looking answer is caused by a chain of weak or missing capabilities, not one single defect:

1. `pdf-parse` extracts raw PDF text without structural math reconstruction.
2. `normalizeText()` only cleans whitespace; it does not repair formulas or symbols.
3. Chunking preserves the already-broken extraction almost verbatim.
4. `buildFileInventory()` scans raw chunk text with regex patterns and captures nearby preview text.
5. `formatFileInventoryResponse()` then emits those previews directly to the user.
6. The model is not even the main culprit in the inventory path, because inventory is deterministic and model-bypassed.

So the broken formula text is primarily:
- **caused by extraction quality**
- **preserved by chunking**
- **exposed by inventory formatting**

It is **not** primarily caused by:
- session routing
- retrieval boundary decisions
- model provider hallucination

## 15. What previous tests did not cover

- No tests for formula preservation from `pdf-parse`
- No tests for Greek symbols, subscripts, fractions, equations, or mixed Hebrew/math extraction fidelity
- No tests for Hebrew RTL integrity in extracted PDF text
- No tests for inventory behavior on broken physics/math extraction
- No tests for cleaning or suppressing unusable formula previews
- No tests for page-level document structure because no page model exists
- No tests for visual PDF understanding because no visual pipeline exists
- Existing math-related tests cover:
  - rendering already-valid LaTeX in chat
  - contract text mentioning LaTeX
  - not extraction-to-LaTeX transformation

## 16. What is safe to fix now

Safe short-term scope:

- Improve inventory output hygiene for noisy extracted math/text
- Add extraction-quality heuristics that detect obviously garbled formula-heavy lines
- Avoid surfacing raw broken previews when extracted text looks low-quality
- Add clearer user-facing wording when extraction is text-only and formula quality is unreliable

These are safe because they do not require:
- redesigning retrieval
- redesigning upload
- building OCR
- building visual page understanding
- inventing a full document model first

## 17. What must be deferred

- True visual PDF understanding
- OCR for scanned/image-only PDFs
- Page image generation and Gemini Vision flow
- Full page/document/question data model from `docs/DOCUMENT_UNDERSTANDING_LAYER.md`
- Robust formula parsing/reconstruction from arbitrary PDF glyph streams
- Full symbolic math tool integration / CAS verification layer
- Multi-file structured inventory redesign

## 18. Recommended smallest next implementation step

- Add a narrow extraction-quality / inventory-sanitization layer for file inventory output.

Specifically:
- detect obviously garbled extracted preview lines
- suppress or rewrite those previews instead of echoing raw broken formula text
- keep the existing heading detection and inventory routing
- add an explicit message such as:
  - extraction found section labels, but math notation in the PDF was not extracted reliably

This is the smallest useful next step because it:
- directly improves the bad current smoke result
- does not pretend to solve visual understanding
- does not require a large new architecture

## 19. Recommended tests for that step

- Unit tests for extraction-quality heuristics on garbled formula-like strings
- Inventory formatter tests proving it does not dump raw broken glyph soup
- Regression test for a physics PDF chunk containing corrupted symbols
- Service-level test proving inventory answer warns about extraction quality limitations when previews are suppressed
- Negative test proving normal clean text previews are still shown unchanged

## 20. Recommended future architecture for true visual/math document understanding

Long-term proper solution:

### Phase 1 — Better document model
- Persist `pageCount`
- Store page-level text records
- Add `understandingStatus`
- Build `documentOutline` and `detectedQuestions`

### Phase 2 — Safer text understanding
- Distinguish:
  - prose
  - section headings
  - formula-heavy spans
  - likely corrupted extraction spans
- Avoid using corrupted spans as primary user-visible previews

### Phase 3 — Math-aware normalization
- Add a formula cleanup pipeline for common PDF extraction artifacts
- Normalize symbols where confidence is high
- Keep low-confidence normalization conservative and explicitly marked

### Phase 4 — Visual path
- Add optional page image generation/storage
- Add page localization for graph/diagram questions
- Add a real vision-provider branch for `visual_reference_request`

### Phase 5 — Math verification tools
- Add separate math tooling for:
  - symbolic manipulation
  - numeric verification
  - equation checking
- Keep these tools separate from plain LLM narration

## 21. Required specific answers

### 1. Why did the tutor output broken formula text?

- Because `pdf-parse` produced noisy raw text for formula-heavy PDF content, and that noisy text was later surfaced directly by deterministic inventory formatting.

### 2. Is the broken formula caused by extraction, chunking, inventory formatting, or model response?

- Primary cause: extraction
- Secondary preservation: chunking
- User-visible exposure: inventory formatting
- Not primarily the model response

### 3. Can the current system ever see PDF diagrams visually?

- No.

### 4. Can the current system recover correct math notation from extracted PDF text?

- No reliable recovery layer exists.

### 5. Does the current system have any math tools?

- No.

### 6. Does the current system have any tests for formula preservation?

- No extraction/formula-preservation tests exist.
- Only LaTeX rendering tests exist for already-valid math strings.

### 7. Does the current system have any tests for visual PDF limitations?

- Yes, partially.
- It has classifier and contract tests for visual limitation behavior.
- It does not have tests for a real visual pipeline because none exists.

### 8. What is the smallest safe improvement now?

- Inventory sanitization plus extraction-quality warning for garbled math-heavy previews.

### 9. What should be explicitly deferred?

- OCR, page-image vision flow, full page/document model, and CAS/math-tool architecture.

### 10. What would a proper long-term solution look like?

- Page-aware document understanding + question indexing + formula-aware normalization + optional vision branch + separate math verification tools.

## 22. Confirmation that no source code was edited

- Confirmed.
- No source code or tests were edited.
- Only this diagnostic report file was created.

## 23. Confirmation that no git add / commit / push was run

- No `git add`
- No `git commit`
- No `git push`

## 24. Confirmation that no git pull was run

- No `git pull`
