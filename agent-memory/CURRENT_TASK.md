# Current Task

## Active task
Phase 16 — Text extraction/parsing boundary for uploaded files.

## Status
Implemented on branch `codex/phase16-text-extraction-boundary`.

## What was implemented
- Added extraction lifecycle fields to uploaded-file domain model and API responses.
- Added server extraction provider boundary:
  - `src/server/workspaces/fileExtractionProvider.ts`
  - deterministic placeholder extraction only (`deterministic_test_parser`).
- Extended uploaded file lifecycle service with synchronous extraction flow:
  - `runExtractionLifecycleForFile(user, workspaceId, fileId)`
  - transitions: `not_started|failed -> pending -> completed|failed`
  - validates ownership, storagePath presence, source type and state transitions.
- Added endpoint:
  - `POST /api/workspaces/[workspaceId]/files/[fileId]/extract`
- Added decision-log coverage for extraction lifecycle:
  - `extraction_requested`
  - `extraction_completed`
  - `extraction_failed`
  - mapped to `decisionType: file_extraction`.
- Backward compatibility:
  - legacy records without `extractionStatus` map to `not_started`.

## Explicit boundaries preserved
- No real PDF parsing.
- No real DOCX parsing.
- No OCR.
- No summaries from extracted text.
- No vector/chunk indexing.
- No retrieval over extracted text.
- No tutor answer grounding from uploaded files.
- No Gemini/Genkit.
- No package/dependency changes.
- No Firebase rules changes.

## Validation executed
- `git diff --check` ✅
- `npm run build` ✅
- `npx vitest run tests/server/workspaces/fileExtractionProvider.test.ts tests/server/workspaces/uploadedFileApiService.test.ts tests/server/workspaces/workspaceFileExtractionApiRoute.test.ts tests/server/workspaces/uploadedFileApiSchemas.test.ts tests/server/workspaces/workspaceFilesApiRoute.test.ts tests/server/workspaces/uploadedFileRepository.test.ts` ✅

## Recommended next phase
Either:
1. real parser implementation behind provider boundary, or
2. chunking/indexing boundary over extracted text.

Tutor retrieval over extracted text is still not implemented.
