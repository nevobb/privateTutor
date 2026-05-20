# Project State

## Project identity
- privateTutor is a personal adaptive academic tutor.
- Core principle: Understanding before progress.

## Current completed milestones
- Phase 15 merged: real file upload foundation.
- Phase 16 merged: extraction lifecycle/provider boundary.
- Phase 17 merged (#50): deterministic file chunking boundary.
- Phase 18 merged (#51): deterministic retrieval over persisted file chunks.
- Phase 19 merged (#52): provider prompt-context injection / grounded tutor answer.
- Phase 20 merged (#53): MVP validation and behavior regression.
- Phase 21 implemented on branch: real PDF/DOCX parser foundation.

## Current capabilities
- Auth emulator flow works.
- Workspace and session APIs/UI work.
- Uploaded file metadata lifecycle exists.
- Extraction lifecycle exists with real parser support:
  - DOCX: mammoth extractRawText
  - PDF: pdf-parse
  - Falls back to deterministic placeholder if no file bytes provided
- Chunking lifecycle: deterministic persisted chunks.
- Retrieval: keyword/token matching over persisted chunks.
- Grounded provider call: SOURCE blocks injected into provider prompt.
- API routes exist:
  - `POST /api/workspaces/[workspaceId]/files/[fileId]/extract` (now accepts multipart/form-data with `file` field)
  - `POST /api/workspaces/[workspaceId]/files/[fileId]/chunks`

## Still not implemented
- OCR (image-based PDFs still produce empty/short extraction with warnings).
- Image/diagram extraction.
- Formula reconstruction.
- Summaries based on extracted content.
- Embeddings/vector indexing over chunks.
- Semantic/vector retrieval.
- Gemini/Genkit.
- Production Firebase deployment.

## Recommended next phase
1. Real parser quality validation with real PDF/DOCX fixture files.
2. UI: surface extraction warnings and status to learner.
3. Semantic/vector retrieval planning.
