# Current Task

## Active task
Phase 21 — Real PDF/DOCX parser foundation.

## Status
Implemented on branch `claude/phase21-real-parser-foundation`.

## What was implemented
- Added packages: `mammoth` (DOCX) and `pdf-parse` (PDF) to dependencies.
- Added `@types/pdf-parse` to devDependencies.
- Updated `src/types/index.ts`:
  - Added `"mammoth_docx_parser"` and `"pdf_parse_pdf_parser"` to `extractionSource` union.
- Updated `src/server/workspaces/fileExtractionProvider.ts`:
  - Added `fileBuffer?: Buffer | null` to `FileExtractionInput`.
  - Added `parserName?: string` and `warnings?: string[]` to `FileExtractionResult`.
  - Updated `source` union to include new real parser values.
  - Kept `DeterministicFileExtractionProvider` unchanged (ignores fileBuffer).
- Created `src/server/workspaces/realDocumentExtractionProvider.ts`:
  - `RealDocumentExtractionProvider` class with injectable `PdfParserFn` / `DocxParserFn` for testing.
  - DOCX: uses mammoth `extractRawText({ buffer })`.
  - PDF: uses pdf-parse `(buffer)`.
  - Text normalization: CRLF → LF, tab → space, multi-space collapse, multi-newline collapse, trim.
  - Warnings: `empty_extracted_text`, `very_short_extracted_text`, `possible_scanned_pdf`.
  - No warnings when text is sufficient.
  - Export `createRealDocumentExtractionProvider(pdfParser?, docxParser?)` for test injection.
  - Export `realDocumentExtractionProvider` singleton.
- Updated `src/server/workspaces/uploadedFileApiService.ts`:
  - `runExtractionLifecycleForFile` now accepts optional `fileBuffer?: Buffer`.
  - When `fileBuffer` is provided, uses `realDocumentExtractionProvider` automatically.
  - When `fileBuffer` is absent, falls back to `repositories.fileExtractionProvider` (deterministic).
  - Decision log rationale updated to include parserName and warnings when real parser used.
- Updated `src/app/api/workspaces/[workspaceId]/files/[fileId]/extract/route.ts`:
  - Reads optional `file` field from `multipart/form-data` POST body.
  - If file bytes provided, passes `Buffer` to service (real parsing path).
  - If no file bytes, calls service without buffer (deterministic fallback — backward compat).
  - `readFileBufferFromRequest` helper is safe: catches parse failures and falls back gracefully.

## Explicit boundaries preserved
- No OCR.
- No image/diagram extraction.
- No formula reconstruction.
- No embeddings/vector search/semantic retrieval (untouched).
- No Gemini/Genkit.
- No Firebase rules changes.
- No changes to retrieval, chunking, or grounding provider files.
- Deterministic test provider preserved and backward compatible.

## Validation executed
- `git diff --check` ✅
- `npm run build` ✅ (note: Codex's Phase 24 untracked files cause local build noise, but branch-clean build passes)
- `npx vitest run tests/server/workspaces/fileExtractionProvider.test.ts tests/server/workspaces/realDocumentExtractionProvider.test.ts tests/server/workspaces/uploadedFileApiService.test.ts tests/server/workspaces/workspaceFileExtractionApiRoute.test.ts` — 28 passed ✅
- `npx vitest run tests/server/workspaces/fileChunker.test.ts tests/server/workspaces/fileChunkRetrievalService.test.ts tests/server/workspaces/sessionMessageApiService.test.ts tests/server/tutor/deepseekProviderGrounding.test.ts` — 47 passed ✅

## Recommended next phase
1. Parser quality validation with real PDF/DOCX fixtures.
2. UI: surface extraction status and warnings to learner.
3. Semantic/vector retrieval planning (if keyword retrieval is insufficient).
