# MVP Validation Report

## Report date
2026-05-19

## MVP capabilities validated

### Full learning-material pipeline
The following end-to-end server-side pipeline is implemented and validated:

1. **File upload** — Storage path + metadata linkage (Phase 15)
2. **Extraction boundary** — `extractionStatus`, `extractedText` lifecycle (Phase 16, deterministic placeholder)
3. **Chunking** — `chunkingStatus`, persisted `FileChunk` records under `files/{fileId}/chunks/{chunkId}` (Phase 17)
4. **Deterministic keyword retrieval** — keyword/token overlap scoring over persisted chunks (Phase 18)
5. **Grounded provider call** — retrieved chunks injected as SOURCE blocks into system prompt; second provider call with `groundingContext` (Phase 19)
6. **Session transcript** — one user message + one grounded tutor message per turn (unchanged shape)

### Validated behaviors

- `retrieval.used = true` when eligible file chunks exist and match query
- citations include `fileId:chunkId` composite source ids
- second grounded provider call receives `groundingContext.chunks` with source ids and text
- transcript has exactly one user + one tutor message per send (no double-write)
- decision log records `retrieval_executed` (with chunk ids) and `Grounded provider call executed` (with `grounding_context_injected=true`)
- public response shape (`userMessage`, `assistantMessage`, `internalUpdate`) unchanged

### Validated negative behaviors

- no eligible chunks → no second grounded provider call, no fake grounding context
- `eligibleFileCount=0` → falls back to legacy indexed-file retrieval path (backward compat)
- `eligibleFileCount>0` but query has no matching chunks → `why=no_matching_file_chunks`, no grounding
- `needs_retrieval=false` → single provider call, no retrieval, no grounding
- web retrieval scope → `retrieveFileChunks` not called, grounding not applied
- `retrieval.why` does not contain "semantic", "vector", or "embedding"
- citation `sourceId` follows deterministic `fileId:chunkId` format

## What is still intentionally not implemented

- **Real PDF/DOCX parsing** — extraction still uses deterministic placeholder (`extractedText` is stub text). Actual file content is not parsed.
- **Real DOCX parsing** — same as above.
- **OCR** — no image/scan text extraction.
- **Summaries** — `summaryStatus` lifecycle exists but no summary content is generated.
- **Embeddings / vector indexing** — no embeddings created over chunks.
- **Semantic/vector retrieval** — retrieval is deterministic keyword/token matching only.
- **Gemini/Genkit** — no Gemini or Genkit provider connected.
- **Production Firebase deployment** — emulator only; no cloud deployment.
- **Full answer grounding quality** — provider prompt receives chunk text, but real grounding quality depends on:
  - real provider (DeepSeek API key configured, or future Gemini)
  - real extracted text (not placeholder)

## Known risks

1. **Extraction placeholder** — `extractedText` is a deterministic stub, not real file content. No user-uploaded PDF/DOCX content is actually read. Grounding is only as good as the extraction.

2. **Two provider calls per grounded turn** — one call for classification/retrieval decision, one grounded call. Acceptable for MVP; optimize later if cost/latency is a concern.

3. **Keyword retrieval precision** — matching is keyword/token overlap, not semantic. A question can miss relevant chunks if wording differs. No semantic fallback exists.

4. **No source transparency in UI** — citations are in `assistantMessage.citations` (metadata) but may not be displayed to the user yet depending on UI implementation.

5. **Memory file drift** — `agent-memory/CURRENT_TASK.md` and `PROJECT_STATE.md` were stale at Phase 20 start. Both updated to reflect Phase 19 completion.

## Recommended next phase

Options in priority order:

1. **Real extraction parser** — replace deterministic placeholder with actual PDF parser (e.g., `pdf-parse` or Gemini File API). This unblocks real-content grounding and is the highest-impact next step.

2. **Source transparency UI** — display citations and chunk text previews in the file panel or chat UI so the learner can see what material was used.

3. **Semantic/vector retrieval planning** — if keyword retrieval proves insufficient, add embeddings over chunks and a vector similarity search layer.
