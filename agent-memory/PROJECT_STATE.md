# Project State

## Project identity
- privateTutor is a personal adaptive academic tutor.
- Core principle: Understanding before progress.

## Current completed milestones
- Phase 15 merged: real file upload foundation (Storage upload + metadata linkage).
- Phase 16 merged: extraction lifecycle/provider boundary for uploaded files.
- Phase 17 merged (#50): deterministic file chunking boundary.
- Phase 18 merged (#51): deterministic retrieval over persisted file chunks.
- Phase 19 implemented on branch: provider prompt-context injection / grounded tutor answer.

## Current capabilities
- Auth emulator flow works.
- Workspace and session APIs/UI work.
- Uploaded file metadata lifecycle exists.
- Summary metadata lifecycle exists.
- Extraction lifecycle exists with deterministic provider boundary.
- Chunking lifecycle exists with deterministic persisted chunks.
- Retrieval execution uses persisted chunks when available (keyword/deterministic).
- Retrieved chunks are injected into provider prompt as grounding context (SOURCE blocks).
- Second grounded provider call made when chunks found — answer grounded on file content.
- API routes exist:
  - `POST /api/workspaces/[workspaceId]/files/[fileId]/extract`
  - `POST /api/workspaces/[workspaceId]/files/[fileId]/chunks`

## Still not implemented
- Real PDF parser (deterministic placeholder active).
- Real DOCX parser.
- OCR.
- Summaries based on extracted file content.
- Embeddings/vector indexing over chunks.
- Semantic/vector retrieval.
- Gemini/Genkit.
- Production Firebase deployment.

## Boundary note
- Phase 19 grounds provider prompts on retrieved chunks via second provider call.
- Retrieval is still deterministic keyword-based, NOT semantic/vector.
- Real extraction placeholder still active — full quality grounding requires real PDF parser.

## Recommended next phase
- Phase 20: end-to-end MVP validation / behavior regression testing with real uploaded files; OR replace extraction placeholder with real PDF parser; OR connect real model provider (Gemini/DeepSeek) for quality grounded answers.
