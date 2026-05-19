# Current Task

## Active task
Step 24 — Embedding lifecycle boundary.

## Status
Completed on branch `codex/phase24-embedding-lifecycle-boundary`.

## What was implemented
- Added chunk embedding lifecycle fields on `FileChunk` metadata:
  - `embeddingStatus`, `embeddingProvider`, `embeddingModel`, `embeddingDimension`, `embeddingUpdatedAt`, `embeddingErrorCode`, `embeddingSourceTextHash`
- Added deterministic mock embedding provider boundary:
  - `src/server/workspaces/fileChunkEmbeddingProvider.ts`
- Added embedding hash utility:
  - `src/server/workspaces/fileChunkEmbeddingHash.ts`
- Added embedding repository for storage path:
  - `users/{userId}/workspaces/{workspaceId}/files/{fileId}/chunks/{chunkId}/embedding/current`
  - file: `src/server/workspaces/fileChunkEmbeddingRepository.ts`
- Added embedding lifecycle service:
  - `src/server/workspaces/fileChunkEmbeddingService.ts`
- Added endpoint:
  - `POST /api/workspaces/[workspaceId]/files/[fileId]/embeddings`
- Added focused tests for provider/repository/service/route.

## Explicit boundaries preserved
- No real embedding provider calls.
- No vector DB.
- No semantic retrieval execution.
- No runtime retrieval behavior changes.
- No parser/extraction changes.
- No provider prompt grounding changes.
- No package or Firebase rules changes.

## Validation executed
- `git diff --check` ✅
- `npm run build` ✅
- `npx vitest run tests/server/workspaces/fileChunkEmbeddingProvider.test.ts tests/server/workspaces/fileChunkEmbeddingRepository.test.ts tests/server/workspaces/workspaceFileEmbeddingsApiRoute.test.ts` ✅
- `npx vitest run tests/server/workspaces/fileChunkRetrievalService.test.ts tests/server/workspaces/sessionMessageApiService.test.ts` ✅

## Recommended next phase
Step 25 — Semantic retrieval execution (hybrid semantic+keyword), with keyword fallback retained.
