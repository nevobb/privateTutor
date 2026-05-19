# Agent Handoff

## Read order
1. `AGENT_TASK_PROTOCOL.md`
2. `AGENTS.md`
3. `agent-memory/PROJECT_STATE.md`
4. `agent-memory/CURRENT_TASK.md`
5. `agent-memory/DECISIONS.md`
6. `agent-memory/TASK_LOG.md`
7. `agent-memory/OPEN_QUESTIONS.md`

## Current status
- Phase 18 retrieval over persisted file chunks is implemented and validated.

## What Phase 18 added
- `fileChunkRetrievalService.ts`: deterministic keyword/token ranking over persisted FileChunk records.
  - Eligible: extractionStatus=completed, chunkingStatus=completed, chunkCount>0.
  - Scores by query-token overlap, tie-breaks by chunkIndex, respects maxChunks + maxTokens.
- `sessionMessageApiService.ts`: non-web retrieval path now prefers persisted chunks when available.
  - Falls back to old indexed-file retrieval when no chunked files exist (backward compat).
  - Citations include chunkId, fileId:chunkId composite sourceId, and reference text preview.
  - Decision-log events updated with chunk ids and file ids.

## Important boundary
- Tutor response text is still not grounded on chunk content.
- Provider prompt does NOT receive retrieved chunks as context.
- Citations are metadata-only; the model does not see them.

## What is still out of scope
- Provider prompt-context injection from chunks.
- Embeddings/vector search.
- OCR.
- Real PDF/DOCX parsing.
- Gemini/Genkit.

## Next recommended step
- Phase 19: wire retrieved chunk text into the provider prompt so tutor responses are actually grounded on file content. Requires prompt rewrite in the tutor provider + careful injection boundaries.
