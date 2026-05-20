# Current Task

## Active task
Step 24 — Embedding lifecycle boundary.

## Status
Implemented on branch `codex/phase24-embedding-lifecycle-boundary`.

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

## Mainline context preserved
- Phase 21 parser foundation from `main` remains intact:
  - real DOCX/PDF parser path (`mammoth`, `pdf-parse`)
  - extraction route multipart file handling
  - extraction provider/type extensions

## Explicit boundaries preserved
- No real embedding provider calls.
- No vector DB.
- No semantic retrieval execution.
- No runtime retrieval behavior changes.
- No parser behavior changes in this branch update.
- No provider prompt grounding changes.

## Recommended next phase
Step 25 — Semantic retrieval execution (hybrid semantic+keyword), with keyword fallback retained.
