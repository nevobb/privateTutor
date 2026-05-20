# Project State

## Project identity
- privateTutor is a personal adaptive academic tutor.
- Core principle: Understanding before progress.

## Current completed milestones
- Phase 15 merged: real file upload foundation.
- Phase 16 merged: extraction lifecycle/provider boundary.
- Phase 17 merged: deterministic file chunking boundary.
- Phase 18 merged: deterministic chunk retrieval.
- Phase 19 merged: grounded provider answer from retrieved chunks.
- Phase 20 merged: MVP validation.
- Phase 21 merged: real PDF/DOCX parser foundation.
- Step 23 merged: semantic/vector architecture decision.
- Step 24 merged: embedding lifecycle boundary.
- Step 25 completed on branch: semantic retrieval execution with keyword fallback.

## Current capabilities
- Upload → extraction → chunking → retrieval → grounded answer.
- Retrieval now supports:
  - semantic execution over available deterministic/mock embeddings
  - automatic keyword fallback when semantic is unavailable/empty/stale/failing
- Grounding context and citations remain compatible with existing flow.

## Still not implemented
- Real embedding provider integration.
- External vector DB.
- Gemini/Genkit.
- Production Firebase deployment.

## Boundary note
- Step 25 did not add real external embedding APIs.
- Step 25 did not change parser behavior.

## Recommended next phase
- Real embedding provider integration (or quality-evaluation phase before provider commitment).
