# Project State

## Project identity
- privateTutor is a personal adaptive academic tutor.
- Core principle: Understanding before progress.

## Current completed milestones
- Phase 15 merged: real file upload foundation.
- Phase 16 merged: extraction lifecycle/provider boundary.
- Phase 17 merged: deterministic file chunking boundary.
- Phase 18 merged: deterministic chunk retrieval.
- Phase 19 merged: grounded provider answer path.
- Phase 20 merged: MVP validation.
- Phase 21 merged: real PDF/DOCX parser foundation.
- Step 23 merged: semantic/vector architecture decision.
- Step 24 merged: embedding lifecycle boundary.
- Step 25 merged: semantic retrieval execution with keyword fallback.
- Step 26 completed on branch: Gemini embedding provider integration.

## Current capabilities
- Upload → extraction → chunking → retrieval → grounded answer.
- Embedding generation now supports:
  - deterministic provider (default/test-safe)
  - Gemini provider (opt-in via env)
- Semantic retrieval can use real Gemini query embeddings when configured.
- Keyword fallback remains in place.

## Still not implemented
- Vector DB.
- Gemini/Genkit chat migration.
- OCR/summaries.
- Production Firebase deployment.

## Boundary note
- Gemini API key is server-only (`GEMINI_API_KEY`, no `NEXT_PUBLIC_`).
- Real Gemini provider is opt-in and not forced by default.

## Recommended next phase
- Retrieval quality evaluation and scoring/cost tuning with real study materials.
