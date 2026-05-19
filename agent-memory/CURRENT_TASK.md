# Current Task

## Active task
Phase 18 — Retrieval over persisted file chunks.

## Status
Implemented on branch `codex/phase18-retrieval-over-file-chunks-wt` (PR target: `codex/phase18-retrieval-over-file-chunks`).

## What was implemented
- Added `fileChunkRetrievalService.ts`:
  - `retrieveRelevantFileChunks(input, deps)` — deterministic keyword/token scoring over persisted chunks.
  - Eligible files: `extractionStatus = completed`, `chunkingStatus = completed`, `chunkCount > 0`.
  - Keyword tokenization with Unicode-safe split on whitespace and punctuation.
  - Ranking: score desc, chunkIndex asc as tie-breaker.
  - Budgets: maxChunks, maxTokens (stop when next chunk would exceed remaining budget).
  - Returns `{ chunks, eligibleFileCount }` so caller can distinguish no-chunks-eligible vs. no-matching-chunks.
- Updated `sessionMessageApiService.ts`:
  - Added `retrieveFileChunks` to `Repositories` interface and `defaultRepositories()`.
  - Non-web retrieval path now tries chunk retrieval first:
    - If `eligibleFileCount > 0` and chunks found: `retrieval.used = true`, source_ids = chunk ids, citations include `chunkId` / `fileId:chunkId` / reference text preview.
    - If `eligibleFileCount > 0` but no matches: `why = "no_matching_file_chunks"`, `retrieval_skipped` event.
    - If `eligibleFileCount === 0`: falls back to old indexed-file retrieval path (backward compat).
  - Decision-log events: `retrieval_executed` with `selected_chunk_ids`, `selected_file_ids`, `total_candidates`.
  - Extracted `executeChunkRetrieval` and `executeLegacyIndexedFileRetrieval` helpers.

## Explicit boundaries preserved
- No embeddings/vector search/semantic retrieval.
- No prompt-context injection into provider (tutor answer generation still not grounded on chunk content).
- No OCR.
- No real PDF/DOCX parsing.
- No Gemini/Genkit.
- No package/dependency changes.
- No Firebase rules changes.

## Validation executed
- `git diff --check` ✅
- `npm run build` ✅
- `npx vitest run tests/server/workspaces/fileChunkRetrievalService.test.ts tests/server/workspaces/sessionMessageApiService.test.ts` — 31 passed ✅
- `npx vitest run tests/server/workspaces/fileChunker.test.ts tests/server/workspaces/fileChunkRepository.test.ts tests/server/workspaces/workspaceFileChunksApiRoute.test.ts` — 8 passed, 2 skipped ✅

## Recommended next phase
Provider prompt-context injection: wire retrieved chunk text into the tutor provider prompt so responses are actually grounded on file content. Or move to semantic/vector retrieval depending on product priority.
