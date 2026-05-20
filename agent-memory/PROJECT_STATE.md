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
- Step 26 merged: Gemini embedding provider integration.
- Step 28A merged: personal use readiness audit report.
- Step 28B implemented on branch `step28b-production-firebase-mode` (pending push/merge).

## Current capabilities
- Upload → extraction → chunking → retrieval → grounded answer.
- Embedding generation supports deterministic + Gemini provider (env-selected).
- Semantic retrieval has keyword fallback.
- Firebase runtime now supports explicit mode split:
  - Emulator mode for local/dev flow.
  - Production mode foundations for real auth/token verification and server Firestore.

## Still not implemented
- UI preferences persistence (theme/text size/line width).
- Session rename.
- Session archive/delete.
- Runtime mock cleanup for real-study mode.
- Vector DB.

## Boundary note
- Gemini API key remains server-only (`GEMINI_API_KEY`, no `NEXT_PUBLIC_`).
- Firebase Admin credentials are server-only and must never be committed.

## Recommended next phase
- Complete Step 28B manual production smoke, then continue with Step 28C/28D personal-use UX/data controls.
