# Project State

## Project identity
- privateTutor is a personal adaptive academic tutor.
- Core principle: Understanding before progress.

## Current completed milestones
- Phase 15 merged: real file upload foundation (Storage upload + metadata linkage).
- Phase 16 merged: extraction lifecycle/provider boundary for uploaded files.
- Phase 17 merged (#50): deterministic file chunking boundary.
- Phase 18 merged (#51): deterministic retrieval over persisted file chunks.
- Phase 19 merged (#52): provider prompt-context injection / grounded tutor answer.
- Phase 20 implemented on branch: MVP validation and behavior regression.

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
- Full pipeline validated: upload → extraction → chunking → retrieval → grounded answer.
- API routes exist:
  - `POST /api/workspaces/[workspaceId]/files/[fileId]/extract`
  - `POST /api/workspaces/[workspaceId]/files/[fileId]/chunks`

## Still not implemented
- Real PDF parser (deterministic placeholder active — `extractedText` is stub).
- Real DOCX parser.
- OCR.
- Summaries based on extracted file content.
- Embeddings/vector indexing over chunks.
- Semantic/vector retrieval.
- Gemini/Genkit.
- Production Firebase deployment.

## Boundary note
- MVP is usable for controlled personal testing.
- Extraction placeholder means actual file content is not read. Real grounding quality requires real parser.
- Retrieval is deterministic keyword-based, NOT semantic/vector.

## Recommended next phase
1. Real PDF/DOCX extraction parser — replace deterministic placeholder.
2. Source transparency UI — display chunk citations in chat.
3. Semantic/vector retrieval — if keyword retrieval proves insufficient.
