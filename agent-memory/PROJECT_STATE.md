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
- Phase 21 merged (#55): real PDF/DOCX parser foundation.
- Step 23 merged (#54): semantic/vector architecture decision.
- Step 24 implemented on branch: embedding lifecycle boundary.

## Current capabilities
- Upload → extraction → chunking → keyword retrieval → grounded provider answer.
- Extraction supports real parser path:
  - DOCX via mammoth
  - PDF via pdf-parse
  - fallback to deterministic provider when file bytes are absent.
- Embedding lifecycle boundary exists on Step 24 branch:
  - deterministic mock embeddings
  - embedding metadata lifecycle on chunks
  - embedding storage under chunk embedding subdocument path

## Still not implemented
- Real embedding provider calls.
- Vector DB integration.
- Semantic retrieval execution/hybrid ranking.
- Gemini/Genkit.
- Production Firebase deployment.

## Boundary note
- Step 24 does not change runtime retrieval behavior.
- Retrieval remains deterministic keyword-based until Step 25.

## Recommended next phase
- Step 25: semantic retrieval execution with hybrid semantic+keyword strategy and fallback.
