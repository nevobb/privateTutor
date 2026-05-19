# Project State

## Project identity
- privateTutor is a personal adaptive academic tutor.
- Core principle: Understanding before progress.

## Current completed milestones
- Phase 15 merged: real file upload foundation.
- Phase 16 merged: extraction lifecycle boundary.
- Phase 17 merged: file chunking boundary.
- Phase 18 merged: deterministic retrieval over persisted chunks.
- Phase 19 merged: grounded provider answer from retrieved chunks.
- Phase 20 merged: MVP validation for pipeline behavior.
- Step 23 completed on branch: semantic/vector retrieval architecture decision.

## Current capabilities
- Upload → extraction boundary → chunking → keyword retrieval → grounded provider call.
- Retrieval is deterministic keyword/token overlap over persisted chunks.
- Cost/work-mode guardrails are active.

## Still not implemented
- Real parser wiring may be evolving separately.
- Embeddings over chunks.
- Vector storage/index service.
- Semantic retrieval execution.
- Hybrid semantic+keyword runtime ranking.
- Gemini/Genkit.
- Production Firebase deployment.

## Boundary note
- Step 23 is planning-only and does not change runtime behavior.
- Semantic/vector plan is documented in `docs/SEMANTIC_RETRIEVAL_DECISION.md`.

## Recommended next phase
- Step 24: Embedding Lifecycle Boundary (provider interface + lifecycle fields + deterministic/mock embedding flow, without semantic retrieval execution).
