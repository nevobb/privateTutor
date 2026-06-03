# QA Gap Report — privateTutor
**Date:** 2026-06-03
**Reviewer:** Claude (QA pass, read-only)

---

## Critical Gaps (blocking real MVP)

### 1. No production tutor provider connected
- **What's missing:** Gemini + Genkit flows not implemented. Web search (Google Search Grounding) not connected.
- **Current state:** `src/server/tutor/providerRegistry.ts` falls back to mock unless `DEEPSEEK_API_KEY` is set. DeepSeek works but is not the intended production provider.
- **Target files:**
  - `src/server/tutor/providerRegistry.ts` — add Gemini provider entry
  - `src/server/tutor/` — create `geminiTutorProvider.ts` (does not exist)
  - `src/server/tutor/webSearchProvider.ts` — interface exists, no real implementation
- **Risk:** Without a real provider, the app cannot fulfill its core purpose.

### 2. Firebase cloud not connected
- **What's missing:** All persistence runs against the local emulator only (`demo-private-tutor`). No production Firestore, Auth, or Storage.
- **Current state:** `firebase.json` and `firestore.rules` are emulator-phase only. Firebase Admin SDK is not present (deferred).
- **Target files:**
  - `src/server/firebase/` — `firestoreEmulatorClient.ts` used everywhere; no cloud client exists
  - `firestore.rules` — not production-ready (see Decision #9 in `DECISION_LOG.md`)
  - `storage.rules` — same status
  - `docs/FIREBASE_PRODUCTION_SETUP.md` — setup doc exists but not executed
- **Risk:** App has no persistence outside local dev.

### 3. File upload not connected to Firebase Storage
- **What's missing:** The file API accepts metadata only. Actual file bytes are never written to cloud storage.
- **Current state:** `src/server/workspaces/uploadedFileApiService.ts` and `uploadedFileRepository.ts` handle metadata; `firebaseStoragePdfBytesLoader.ts` exists (300 lines) but is only used for reading, not for upload intake.
- **Target files:**
  - `src/app/api/workspaces/[workspaceId]/files/route.ts` — upload endpoint
  - `src/server/workspaces/firebaseStoragePdfBytesLoader.ts` — read path exists, write path missing
- **Risk:** Upload → extract → chunk → embed pipeline exists end-to-end but has no real file input.

### 4. Learner Memory not durable
- **What's missing:** `learnerMemoryApiService.ts` and `learnerMemoryRepository.ts` exist, but memory writes are not persisted across sessions in any reliable way.
- **Target files:**
  - `src/server/workspaces/learnerMemoryApiService.ts`
  - `src/server/workspaces/learnerMemoryRepository.ts`
  - `src/app/api/learner-memory/` — API route exists but persistence layer is incomplete
- **Risk:** Core product differentiator ("tutor that knows you over time") does not function.

### 5. Firebase Admin SDK absent
- **What's missing:** `decisionLog` writes are currently client-SDK (Web SDK), not server-side Admin SDK. This is a documented security compromise (Decision #9).
- **Target files:**
  - `src/server/workspaces/decisionLogRepository.ts` — needs Admin SDK path
  - `src/server/auth/resolveAuthenticatedUser.ts` — token verification uses emulator verifier by default, not Admin SDK
- **Risk:** Security boundary is not production-grade; decisionLog is client-accessible.

---

## Known Bugs (functional regressions)

| Bug | File(s) | Severity |
|-----|---------|----------|
| Conversation rename shows false timeout + late success | `src/app/api/sessions/[sessionId]/route.ts`, `src/components/chat/` | Medium |
| Upload from composer does not set file as session context | `src/server/workspaces/sessionMessageApiService.ts`, composer component | Medium |
| Workspace/course delete not safely implemented (no soft-delete) | `src/server/workspaces/workspaceRepository.ts` | Medium |
| Settings controls may not hydrate on first load | `src/app/settings/`, CSS variable contract | Low |

---

## Missing Features (deferred, not broken)

- **Diagram-aware Deep PDF / visual understanding** — `deepPdfOrchestrationService.ts` handles text only; no image/diagram extraction path exists.
- **Richer source metadata in tutor responses** — `sessionMessageApiService.ts` attaches source labels but they surface as raw IDs in the UI.
- **Genkit flow layer** — `docs/04_Firebase_Genkit_Backend_Architecture.md` specifies flows (`handleTutorMessageFlow`, `retrieveContextFlow`, etc.); none are implemented.
- **Semantic summary hierarchy** — PRD sections 20–21 (file → topic → workspace → semester summaries) not implemented; only per-file understanding exists.

---

## Packages / Stack Notes

All dependencies are current as of June 2026 (Next.js 16, React 19, Firebase 12, Tailwind 4, Vitest 4). No outdated or deprecated packages observed. No security flags.

---

## Recommended Implementation Order

1. Firebase Admin SDK + cloud Firestore connection
2. File upload to Firebase Storage (unblock the existing pipeline)
3. Learner Memory durable persistence
4. Real tutor provider (Gemini via Genkit, or extend DeepSeek for now)
5. Conversation rename timeout fix
6. Web search provider implementation
7. Workspace/course soft delete
8. Source metadata enrichment
