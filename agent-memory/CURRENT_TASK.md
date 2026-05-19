# Current Task

## Active task
Phase 17 — File chunking boundary for extracted uploaded files.

## Status
Implemented on branch `codex/phase17-file-chunking-boundary`.

## What was implemented
- Added chunking lifecycle fields to uploaded-file model and API responses:
  - `chunkingStatus`, `chunkCount`, `chunkingErrorCode`, `chunkingUpdatedAt`.
- Added shared chunk model:
  - `FileChunk` in `src/types/index.ts`.
- Added deterministic chunking utility:
  - `src/server/workspaces/fileChunker.ts`
  - default `maxChars=1200`, `overlapChars=150`, deterministic token estimate.
- Added chunk repository:
  - `src/server/workspaces/fileChunkRepository.ts`
  - path: `users/{userId}/workspaces/{workspaceId}/files/{fileId}/chunks/{chunkId}`.
- Extended uploaded-file lifecycle service with synchronous chunking flow:
  - `runChunkingLifecycleForFile(user, workspaceId, fileId)`
  - validates ownership + extraction prerequisites
  - transitions to `pending -> completed|failed`
  - replaces persisted chunks deterministically.
- Added endpoint:
  - `POST /api/workspaces/[workspaceId]/files/[fileId]/chunks`.
- Added decision-log events for chunking lifecycle:
  - `chunking_requested`, `chunking_completed`, `chunking_failed`
  - mapped to `decisionType: file_chunking`.
- Backward compatibility:
  - legacy records without `chunkingStatus` map to `not_started`.

## Explicit boundaries preserved
- No embeddings/vector search/semantic retrieval.
- No tutor grounding from chunks.
- No OCR.
- No real PDF/DOCX parsing.
- No summaries from extracted text.
- No Gemini/Genkit.
- No package/dependency changes.
- No Firebase rules changes.

## Validation executed
- `git diff --check` ✅
- `npm run build` ✅
- `npx vitest run tests/server/workspaces/fileChunker.test.ts tests/server/workspaces/fileChunkRepository.test.ts tests/server/workspaces/uploadedFileApiService.test.ts tests/server/workspaces/workspaceFileChunksApiRoute.test.ts` ✅
- `npx vitest run tests/server/workspaces/fileExtractionProvider.test.ts tests/server/workspaces/workspaceFileExtractionApiRoute.test.ts tests/server/workspaces/uploadedFileApiSchemas.test.ts tests/server/workspaces/workspaceFilesApiRoute.test.ts` ✅

## Recommended next phase
Retrieval over persisted chunks (or retrieval decision integration using chunk metadata), while keeping tutor grounding rollout explicitly scoped.
