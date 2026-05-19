# Project State

## Project identity
- privateTutor is a personal adaptive academic tutor.
- Core principle: Understanding before progress.

## Current completed milestones
- Batch 4 / Phase 8: metadata-first file intake/classify/index lifecycle — merged.
- Batch 4 / Phase 9: metadata-only summary lifecycle contract — merged.
- Batch 4 / Phase 10: retrieval execution scaffolding — merged.
- Batch 5 / Phase 11/12/13: learner-memory + cost-mode + work-mode hardening — merged.
- Batch 5 / Phase 14: policy-gated web retrieval boundary with deterministic provider path — merged.
- Phase 15 (this branch): real file upload foundation (Storage upload + metadata link) — implemented.

## Current capabilities
- Auth emulator flow works.
- Workspace and Session API/UI exist.
- Session transcript persistence exists.
- Decision log persistence exists.
- Uploaded files API exists (`GET/POST /api/workspaces/[workspaceId]/files`).
- Real client-side PDF/DOCX upload path to Firebase Storage exists (foundation level).
- Uploaded file metadata records now support validated Storage path ownership binding.

## Still not implemented
- PDF/DOCX content extraction/parsing.
- OCR.
- Real summary generation from file contents.
- Real retrieval over extracted file contents.
- Vector/chunk indexing over real text.
- Gemini/Genkit integration.
- Production Firebase deployment.

## Scope boundary note for Phase 15
- Phase 15 uploads binaries and stores metadata linkage only.
- Tutor still cannot read uploaded file contents yet.

## Recommended next phase
- Text extraction/parsing boundary for uploaded PDF/DOCX files.
