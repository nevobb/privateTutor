# Automatic File Processing Pipeline Report

## Cause
- Why manual buttons were wrong for real use:
  - Manual Extract/Chunk/Embed created a fragile UX dependency on narrow sidebar controls for a core learning path.
  - Real study flow needs automatic readiness after upload, not diagnostic button choreography.
- Why current UI blocked processing:
  - File actions lived in cramped row-level controls in a narrow RTL panel, so key controls could be clipped/hidden.

## Implementation
- Upload pipeline:
  - Added automatic pipeline trigger immediately after successful upload + metadata creation.
  - Pipeline is orchestrated in `src/app/page.tsx` (`runFileProcessingPipeline`).
- Extraction:
  - Pipeline starts with extraction when file extraction is not already completed.
  - If file bytes are unavailable and extraction is still required, status is set to re-upload guidance.
- Chunking:
  - Automatically runs after extraction unless already completed.
- Embeddings:
  - Automatically runs after chunking.
  - Final state records `Ready for learning` when no embedding failures are reported.
- Ready state:
  - UI shows ready signal when extraction+chunking are completed and processing status indicates embedding completion.
- Retry behavior:
  - Failed states surface `Retry processing` action.
  - Retry starts from the first incomplete lifecycle step.
- Existing partial files:
  - Added `Continue processing` action for partial files (e.g., E completed, C not_started).
  - Continue resumes from first incomplete step (chunking, then embeddings).

## UI behavior
- Normal user view:
  - File row now emphasizes lifecycle/status with one primary action (`Continue processing` / `Retry processing` / `Processing...`) instead of three manual diagnostic buttons.
- Advanced/developer actions:
  - Manual Extract/Chunk/Embed are no longer required for the happy path.
- RTL/narrow panel handling:
  - Filename truncation and wrapped status/action rows remain in place to prevent clipping.
- Error states:
  - Clear per-file processing status text remains visible and updates per step.

## Manual smoke
- New PDF auto processed:
  - Not executed in this terminal-only run (requires interactive browser smoke).
- Existing partial file continued:
  - Not executed in this terminal-only run.
- Tutor answered from file:
  - Not executed in this terminal-only run.
- Refresh behavior:
  - Not executed in this terminal-only run.
- Browser/terminal errors:
  - No build/test terminal errors during validation.

## Validation
- npm run build:
  - passed
- tests:
  - `tests/server/workspaces/sessionMessageApiService.test.ts` passed
  - `tests/server/workspaces/fileChunkRetrievalService.test.ts` passed
  - `tests/server/workspaces/fileChunkSemanticRetrievalService.test.ts` passed
  - `tests/components/files/FilePanel.test.tsx` passed
- git diff --check:
  - passed
- gitleaks --no-git:
  - pending in this report until final run
- gitleaks history:
  - pending in this report until final run

## Files changed
- `src/app/page.tsx`
- `src/components/files/FilePanel.tsx`
- `tests/components/files/FilePanel.test.tsx`
- `agent-memory/AUTOMATIC_FILE_PROCESSING_REPORT.md`

## Risks / limitations
- Manual production smoke still required to confirm full end-to-end behavior in browser (upload → auto extract/chunk/embed → tutor grounding).
- Embedding completion is tracked by process status text in UI; there is no persisted file-level `embeddingsStatus` field yet.

## Recommendation
- PUSH CONDITIONAL requested.
