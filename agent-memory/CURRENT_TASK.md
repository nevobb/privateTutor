# Current Task

## Active task
Phase 19 — Provider prompt-context injection / grounded tutor answer.

## Status
Implemented on branch `codex/phase19-grounded-tutor-answer`.

## What was implemented
- Added grounding types to `schemas.ts`:
  - `GroundingChunkContext` — chunk reference with source id, file id, chunk id, text, token estimate.
  - `TutorGroundingContext` — mode ("none"|"file_chunks"), chunks array, total token estimate, instruction.
  - `TutorRequest.groundingContext?: TutorGroundingContext` — optional grounding field on provider request.
- Added `deepseekGroundingPrompt.ts`:
  - `buildGroundingSection(groundingContext?)` — formats chunks as bounded `[SOURCE id chunkIndex=N]...[/SOURCE]` blocks.
  - Returns `""` when mode is "none" or chunks are empty (no injection for non-grounded calls).
- Updated `deepseekTutorProvider.ts`:
  - Injects grounding section into system prompt when `request.groundingContext` is provided.
  - Section appears after harness JSON contract.
- Updated `mockTutorProvider.ts`:
  - Records grounding context metadata in mock_provider decision log event detail.
- Updated `sessionMessageApiService.ts`:
  - `executeChunkRetrieval` now returns `{ citations, retrievedChunks: RetrievedFileChunk[] }`.
  - `executeLegacyIndexedFileRetrieval` and `executeWebSearchRetrieval` return `retrievedChunks: []`.
  - After retrieval, if `retrievedChunks.length > 0`:
    - `buildGroundingContextFromChunks` builds `TutorGroundingContext` from retrieved chunks.
    - Second provider call (`getMockTutorResponse`) made with `groundingContext`.
    - Second call's `message.content` replaces original (grounded answer).
    - Decision log event: `retrieval_executed` / "Grounded provider call executed" / `grounding_context_injected=true`.
  - No second call when no chunks found — behavior unchanged for legacy/web/no-retrieval paths.
  - `getMockTutorResponse` signature updated to accept optional `groundingContext`.
  - `defaultGetTutorResponse` passes `groundingContext` to provider.

## Explicit boundaries preserved
- No embeddings/vector search/semantic retrieval.
- No OCR.
- No real PDF/DOCX parsing.
- No Gemini/Genkit.
- No package/dependency changes.
- No Firebase rules changes.
- Retrieval is still deterministic keyword-based (Phase 18), not semantic.

## Important boundary note
- MVP full path now works: upload → extraction → chunking → retrieval → grounded provider prompt → answer.
- Real PDF/DOCX parsing not yet implemented (deterministic placeholder still active).
- Production grounding quality depends on real provider (DeepSeek/Gemini) + real extraction pipeline.

## Validation executed
- `git diff --check` ✅
- `npm run build` ✅
- `npx vitest run tests/server/tutor/deepseekProviderGrounding.test.ts tests/server/workspaces/sessionMessageApiService.test.ts tests/server/workspaces/fileChunkRetrievalService.test.ts` — 43 passed ✅
- `npx vitest run tests/server/workspaces/fileChunker.test.ts tests/server/workspaces/fileChunkRepository.test.ts tests/server/workspaces/workspaceFileChunksApiRoute.test.ts` — 8 passed, 2 skipped ✅

## Recommended next phase
End-to-end MVP validation / behavior regression; or real extraction pipeline (replace deterministic placeholder with actual PDF/DOCX parser); or semantic/vector retrieval upgrade.
