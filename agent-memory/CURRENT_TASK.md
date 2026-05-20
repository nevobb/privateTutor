# Current Task

## Active task
Step 26 — Gemini embeddings provider integration.

## Status
Completed on branch `codex/phase26-gemini-embedding-provider`.

## What was implemented
- Added real Gemini embedding provider (server-side) for `gemini-embedding-001`:
  - `src/server/workspaces/geminiFileChunkEmbeddingProvider.ts`
- Added provider selection:
  - `EMBEDDING_PROVIDER=deterministic|gemini`
  - `GEMINI_API_KEY` required only for `gemini`
- Updated embedding input contract with purpose:
  - `embeddingPurpose: document | query`
- Chunk embeddings use document task (`RETRIEVAL_DOCUMENT`).
- Query embeddings use query task (`QUESTION_ANSWERING`).
- Embedding service now skips unchanged completed chunk embeddings when hash matches.
- Semantic retrieval remains guarded and falls back to keyword retrieval on semantic/provider failure.

## Explicit boundaries preserved
- No vector DB.
- No parser changes.
- No Gemini chat/Genkit migration.
- No OCR/summaries.
- No client-side API key exposure (`NEXT_PUBLIC_*` not used).

## Validation executed
- `git diff --check` ✅
- `npm run build` ✅
- `npx vitest run tests/server/workspaces/geminiFileChunkEmbeddingProvider.test.ts tests/server/workspaces/fileChunkEmbeddingService.test.ts tests/server/workspaces/fileChunkSemanticRetrievalService.test.ts` ✅
- `npx vitest run tests/server/workspaces/fileChunkEmbeddingProvider.test.ts tests/server/workspaces/fileChunkEmbeddingRepository.test.ts tests/server/workspaces/fileChunkRetrievalService.test.ts tests/server/workspaces/sessionMessageApiService.test.ts` ✅

## Recommended next phase
Retrieval quality evaluation on real corpus and decision on full real-provider rollout tuning.
