# Current Task

## Active task
Phase 20 — MVP validation and behavior regression.

## Status
Implemented on branch `codex/phase20-mvp-validation`.

## What was implemented
- Created `tests/behavior/` directory.
- Added `tests/behavior/mvpFileLearningPipeline.test.ts`:
  - Happy path: extraction+chunking completed files → retrieval → grounding → grounded answer (15 tests).
  - Negative path: no eligible chunks → no grounding → no fake citations.
  - Negative path: eligible files but no matching chunks → `no_matching_file_chunks`.
  - Negative path: `needs_retrieval=false` → single provider call.
  - Web retrieval scope → chunk retrieval not called.
  - Boundary: retrieval why does not contain "semantic"/"vector"/"embedding".
  - Citation sourceId format follows `fileId:chunkId` pattern.
- Added `agent-memory/MVP_VALIDATION_REPORT.md`.
- Updated `CURRENT_TASK.md`, `AGENT_HANDOFF.md`, `TASK_LOG.md`, `PROJECT_STATE.md`.

## Explicit boundaries preserved
- No new features added.
- No embeddings/vector search/semantic retrieval.
- No OCR.
- No real PDF/DOCX parsing.
- No Gemini/Genkit.
- No package/dependency changes.
- No Firebase rules changes.

## Validation executed
- `git diff --check` ✅
- `npm run build` ✅
- `npx vitest run tests/behavior/mvpFileLearningPipeline.test.ts` — 15 passed ✅
- `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts tests/server/workspaces/fileChunkRetrievalService.test.ts tests/server/tutor/deepseekProviderGrounding.test.ts` — 43 passed ✅

## Recommended next phase
1. Real PDF/DOCX extraction parser to replace deterministic placeholder.
2. OR source transparency UI (display citations/chunk previews in chat).
3. OR semantic/vector retrieval planning.
