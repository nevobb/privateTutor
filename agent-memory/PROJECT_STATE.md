# Project State

## Project identity
- privateTutor is a personal adaptive academic tutor.
- Core principle: Understanding before progress.

## Current completed milestones
- Phase 15 merged: real file upload foundation.
- Phase 16 merged: extraction lifecycle boundary.
- Phase 17 merged: file chunking boundary.
- Phase 18 merged: deterministic chunk retrieval.
- Phase 19 merged: grounded provider answer from retrieved chunks.
- Phase 20 merged: MVP pipeline validation.
- Step 23 merged: semantic/vector architecture decision.
- Step 24 completed on branch: embedding lifecycle boundary.

## Current capabilities
- Upload → extraction boundary → chunking → keyword retrieval → grounded provider answer.
- Embedding lifecycle boundary now exists for persisted chunks:
  - deterministic mock embeddings
  - embedding metadata lifecycle
  - embedding storage under chunk embedding subdocument path

## Still not implemented
- Real embedding provider calls.
- Vector DB integration.
- Semantic retrieval execution/hybrid ranking.
- Parser maturity may be evolving separately.
- Gemini/Genkit.
- Production Firebase deployment.

## Boundary note
- Step 24 does not change runtime retrieval behavior.
- Retrieval remains deterministic keyword-based.

## Recommended next phase
- Step 25: semantic retrieval execution with hybrid semantic+keyword strategy and fallback.
