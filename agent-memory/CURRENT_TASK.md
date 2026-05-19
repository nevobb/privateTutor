# Current Task

## Active task
Phase 15 — Real file upload foundation.

## Status
Implemented on branch `codex/phase15-real-file-upload-foundation`.

## What was implemented
- Added client Storage upload helper:
  - `src/lib/firebase/storageUploadClient.ts`
  - validates PDF/DOCX, max size 20MB, empty-file rejection, filename sanitization.
- Extended client Firebase module with Storage accessor:
  - `src/lib/firebase/firebaseClientApp.ts` (`getClientStorage`).
- Added workspace files API client/types:
  - `src/lib/workspaces/workspaceFilesApiClient.ts`
  - `src/lib/workspaces/workspaceFilesApiTypes.ts`
- Added minimal UI upload path in existing sidebar File panel:
  - `src/components/files/FilePanel.tsx`
  - `src/app/page.tsx` integration
  - statuses: idle/validating/uploading/saving_metadata/done/error.
- Hardened server-side metadata validation:
  - `src/server/workspaces/uploadedFileApiSchemas.ts` (sourceType-extension + filename validation)
  - `src/server/workspaces/uploadedFileApiService.ts` (storagePath ownership/path validation)
  - `src/app/api/workspaces/[workspaceId]/files/route.ts` (returns 400 on validation errors)
- Added focused tests:
  - `tests/lib/firebase/storageUploadClient.test.ts`
  - updated uploaded-file schema/service/route tests.

## Explicit boundaries preserved
- No PDF/DOCX parsing.
- No OCR or text extraction.
- No vector/chunk indexing over real content.
- No real retrieval over uploaded file content.
- No Gemini/Genkit.
- No dependency changes.
- No Firebase rules changes.

## Validation executed
- `npx vitest run tests/server/workspaces/uploadedFileApiSchemas.test.ts tests/server/workspaces/uploadedFileApiService.test.ts tests/server/workspaces/workspaceFilesApiRoute.test.ts tests/lib/firebase/storageUploadClient.test.ts` ✅
- `git diff --check` ✅
- `npm run build` ✅

## Recommended next phase
Text extraction/parsing boundary for uploaded PDF/DOCX files.
