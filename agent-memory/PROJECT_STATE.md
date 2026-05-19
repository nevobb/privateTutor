# Project State

## Project identity
- privateTutor is a personal adaptive academic tutor.
- Core principle: Understanding before progress.

## Current completed milestones
- Phase 15 merged: real file upload foundation (Storage upload + metadata linkage).
- Phase 16 merged: extraction lifecycle/provider boundary for uploaded files.
- Phase 17 merged (#50): deterministic file chunking boundary.
- Phase 18 implemented on branch: deterministic retrieval over persisted file chunks.

## Current capabilities
- Auth emulator flow works.
- Workspace and session APIs/UI work.
- Uploaded file metadata lifecycle exists.
- Summary metadata lifecycle exists.
- Extraction lifecycle exists with deterministic provider boundary.
- Chunking lifecycle exists with deterministic persisted chunks.
- Retrieval execution uses persisted chunks when available (keyword/deterministic).
- API routes exist:
  - `POST /api/workspaces/[workspaceId]/files/[fileId]/extract`
  - `POST /api/workspaces/[workspaceId]/files/[fileId]/chunks`

## Still not implemented
- Provider prompt-context injection from retrieved chunks (tutor answers not yet grounded on file content).
- Real PDF parser.
- Real DOCX parser.
- OCR.
- Summaries based on extracted file content.
- Embeddings/vector indexing over chunks.
- Semantic/vector retrieval.
- Gemini/Genkit.
- Production Firebase deployment.

## Boundary note
- Phase 18 adds deterministic chunk retrieval as metadata/citation enrichment only.
- Provider prompt does NOT receive chunk text as context yet.
- Tutor answer generation is NOT grounded on chunk content until prompt injection is implemented.

## Recommended next phase
- Phase 19: provider prompt-context injection — wire retrieved chunk text into the tutor provider prompt so responses are grounded on file content.
