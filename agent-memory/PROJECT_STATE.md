# Project State

## Project identity
- privateTutor is a personal adaptive academic tutor.
- Core principle: Understanding before progress.

## Current completed milestones
- Phase 15 merged: real file upload foundation (Storage upload + metadata linkage).
- Phase 16 implemented on branch: extraction lifecycle/provider boundary for uploaded files.

## Current capabilities
- Auth emulator flow works.
- Workspace and session APIs/UI work.
- Uploaded file metadata lifecycle exists.
- Summary metadata lifecycle exists.
- Extraction lifecycle now exists with deterministic provider boundary.
- API route for extraction exists:
  - `POST /api/workspaces/[workspaceId]/files/[fileId]/extract`

## Still not implemented
- Real PDF parser.
- Real DOCX parser.
- OCR.
- Summaries based on extracted file content.
- Vector/chunk indexing over extracted text.
- Retrieval over extracted text.
- Tutor grounding/answers from uploaded file content.
- Gemini/Genkit.
- Production Firebase deployment.

## Boundary note
- Phase 16 stores extraction metadata/text placeholders only.
- Tutor still cannot use uploaded file content for answers.

## Recommended next phase
- Real parser implementation or chunking boundary, then retrieval wiring in a later scoped phase.
