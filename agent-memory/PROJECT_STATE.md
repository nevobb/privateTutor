# Project State

## Project identity
- privateTutor is a personal adaptive academic tutor.
- Core principle: Understanding before progress.

## Current completed milestones
- Phase 15 merged: real file upload foundation (Storage upload + metadata linkage).
- Phase 16 merged: extraction lifecycle/provider boundary for uploaded files.
- Phase 17 implemented on branch: deterministic file chunking boundary.

## Current capabilities
- Auth emulator flow works.
- Workspace and session APIs/UI work.
- Uploaded file metadata lifecycle exists.
- Summary metadata lifecycle exists.
- Extraction lifecycle exists with deterministic provider boundary.
- Chunking lifecycle exists with deterministic persisted chunks.
- API routes exist:
  - `POST /api/workspaces/[workspaceId]/files/[fileId]/extract`
  - `POST /api/workspaces/[workspaceId]/files/[fileId]/chunks`

## Still not implemented
- Real PDF parser.
- Real DOCX parser.
- OCR.
- Summaries based on extracted file content.
- Embeddings/vector indexing over chunks.
- Retrieval over extracted/chunked file text.
- Tutor grounding/answers from uploaded file content.
- Gemini/Genkit.
- Production Firebase deployment.

## Boundary note
- Phase 17 stores deterministic chunks from `extractedText` only.
- Tutor still cannot use uploaded file content/chunks for answers.

## Recommended next phase
- Retrieval integration over persisted chunks (policy-gated), then controlled grounding rollout.
