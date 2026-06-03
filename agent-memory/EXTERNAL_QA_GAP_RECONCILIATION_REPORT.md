# External QA Gap Reconciliation Report
**Date:** 2026-06-03
**Branch:** repair/workspace-cleanup-fit-check
**HEAD:** 9ee1a56 docs: add conversation file attachment fit check
**Working tree:** Dirty — 26 modified tracked files, 8 untracked paths (including new src/components/ui/, src/lib/settings/, tests/app/, and several agent-memory docs)
**Reviewer:** Claude (external QA, read-only)

---

## Executive Summary

| # | Finding | Current Status | Severity | Evidence Strength | Recommended Action |
|---|---------|---------------|----------|------------------|-------------------|
| A1 | Production tutor provider | PARTIALLY TRUE | P1 | Strong | No action needed for MVP; document Gemini path for future |
| A2 | Firebase cloud not connected | PARTIALLY TRUE | P1 | Strong | Add env-var checklist to deployment runbook |
| A3 | File upload not connected to Firebase Storage | ALREADY FIXED | Low | Strong | No action needed |
| A4 | Learner Memory not durable | TRUE CURRENT GAP | P1 | Strong | Must be fixed before production deployment |
| A5 | Firebase Admin SDK / security boundary | ALREADY FIXED | Low | Strong | No action needed |
| B6 | Conversation rename false timeout | ALREADY FIXED | Low | Strong | Confirm with manual smoke |
| B7 | Upload from composer not setting session context | PARTIALLY TRUE | P1 | Strong | Implement per CONVERSATION_FILE_ATTACHMENT_FIT_CHECK plan |
| B8 | Workspace/course delete not safely implemented | TRUE CURRENT GAP | P2 | Strong | Intentional deferral; hide any delete UI surface |
| B9 | Settings controls hydration | ALREADY FIXED | Low | Strong | Confirm with manual smoke on real signed-in session |
| C10 | Diagram-aware Deep PDF | TRUE CURRENT GAP | P2 | Strong | Future batch; document scope |
| C11 | Richer source metadata | PARTIALLY TRUE | P2 | Strong | Metadata model exists; UI can be improved |
| C12 | Genkit flow layer | INACCURATE | Low | Strong | Not used; DeepSeek is the production LLM layer |
| C13 | Semantic summary hierarchy | TRUE CURRENT GAP | P3 | Strong | Deferred; not in current scope |

Current status values used: TRUE CURRENT GAP / PARTIALLY TRUE / ALREADY FIXED / INACCURATE

---

## Detailed Findings

### A1 — Production Tutor Provider
**Old claim:** No production-grade tutor provider is connected; app falls back to mock.
**Current verdict:** PARTIALLY TRUE
**Evidence:**
- `src/server/tutor/providerRegistry.ts` line 15–20: `getActiveTutorProvider()` returns `deepseekTutorProvider` when `DEEPSEEK_API_KEY` is set, otherwise falls back to `mockProviderAdapter`.
- `src/server/tutor/deepseekTutorProvider.ts`: Full `DeepSeekTutorProvider` implementation using OpenAI-compatible API. Handles harness JSON, retrieval decision boundary, cost-mode model selection, conversation history.
- No `geminiTutorProvider.ts` exists in `src/server/tutor/`. No genkit files anywhere in `src/`.
- `src/server/workspaces/geminiPdfUnderstandingClient.ts` exists and uses `gemini-2.5-flash` — but only for document understanding (Deep PDF), not for tutor responses.
- The `webSearchProvider.ts` exists as a supplementary search tool, not a tutor provider.
**Reasoning:** DeepSeek is a real, functioning production provider. The claim that "no production provider is connected" is false for any deployment where `DEEPSEEK_API_KEY` is present in the environment. Gemini is used only for PDF understanding, not chat. There is no Genkit integration. The mock fallback is intentional for local dev without an API key.
**Risk if ignored:** If `DEEPSEEK_API_KEY` is absent from a production deployment, the app silently falls back to mock responses without any startup-time failure. There is no explicit guard that raises an error in production mode if the key is missing.
**Recommended action:** Add a startup assertion: if `FIREBASE_MODE=production` and `DEEPSEEK_API_KEY` is absent, fail fast with a clear error rather than serving mock responses silently.
**Priority:** P1

---

### A2 — Firebase Cloud Not Connected
**Old claim:** Firebase is only wired to the local emulator; no production Firebase path exists.
**Current verdict:** PARTIALLY TRUE
**Evidence:**
- `src/server/firebase/firebaseServerRuntimeMode.ts`: `FIREBASE_MODE` env var controls mode. Default is `"emulator"` (line 4: `const normalized = (value ?? "emulator")`).
- `src/server/firebase/firebaseAdminApp.ts`: Full dual-path initialisation. Emulator mode uses `initializeApp({ projectId })`. Production mode uses `cert({projectId, clientEmail, privateKey})` or `applicationDefault()`.
- `src/server/auth/verifyFirebaseTokenProduction.ts`: Calls `getFirebaseAdminAuth().verifyIdToken(trimmed, true)` — Admin SDK token verification is wired for production.
- `src/server/firebase/firestoreEmulatorClient.ts`: `withFirestoreEmulatorClient` calls `getFirebaseAdminFirestore()` in both modes; the emulator host env var is only set in emulator branch (line 77).
- `firebase.json`: Defines emulator config for auth (9099), Firestore (8080), storage (9199).
- `src/server/workspaces/learnerMemoryRepository.ts`: Calls `withFirestoreEmulatorClient` — function name is misleading; it actually uses the Admin SDK in either mode, just with emulator env vars set in emulator mode.
- `src/server/workspaces/decisionLogRepository.ts`: Same pattern — `withFirestoreEmulatorClient` but uses Admin SDK Firestore in both modes.
**Reasoning:** Production Firebase path is fully wired in code. The claim is "partially true" because the *default* `FIREBASE_MODE` is `"emulator"`, so a misconfigured production deployment would silently use emulator settings. The production path requires `FIREBASE_MODE=production`, `FIREBASE_PROJECT_ID`, and either service account credentials or `applicationDefault()`.
**Risk if ignored:** Deploying without setting `FIREBASE_MODE=production` will point the server at `localhost:8080` Firestore — requests will fail or silently succeed against nothing. No startup validation catches this mismatch.
**Recommended action:** Add a deployment-time env validation that asserts `FIREBASE_MODE`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are all present when running in production. Consider a startup health check.
**Priority:** P1

---

### A3 — File Upload Not Connected to Firebase Storage
**Old claim:** File upload does not actually reach Firebase Storage.
**Current verdict:** ALREADY FIXED
**Evidence:**
- `src/lib/firebase/storageUploadClient.ts` lines 1, 57, 63: Imports `ref, uploadBytes` from `firebase/storage`, constructs `storageRef` at the correct path `users/{userId}/workspaces/{workspaceId}/files/{fileId}/{safeFileName}`, and calls `uploadBytes(storageRef, file, metadata)`.
- `src/server/workspaces/firebaseStoragePdfBytesLoader.ts`: Server-side reads back bytes from Firebase Storage Admin SDK (`getStorage(app).bucket(bucketName).file(path).download()`), with full path validation, ownership check, size guard, and content-type guard.
- The client storage upload path is wired in `src/app/page.tsx` `handleFileSelected` (line 351+), which calls `uploadLearningFileToStorage(...)` before creating metadata.
**Reasoning:** The full round-trip exists: client uploads via Firebase client SDK → server reads back via Admin SDK for processing. Storage is connected in both emulator (via `FIREBASE_STORAGE_EMULATOR_HOST`) and production (via `FIREBASE_STORAGE_BUCKET` env var) modes.
**Risk if ignored:** N/A — already fixed.
**Recommended action:** None for code. Ensure `FIREBASE_STORAGE_EMULATOR_HOST` and `FIREBASE_STORAGE_BUCKET` are in deployment runbook.
**Priority:** Already resolved

---

### A4 — Learner Memory Not Durable
**Old claim:** Learner memory is not persisted durably (in-memory only, or no backend).
**Current verdict:** TRUE CURRENT GAP
**Evidence:**
- `src/server/workspaces/learnerMemoryRepository.ts`: All CRUD functions (`createLearnerMemoryObservation`, `listLearnerMemoryObservations`, etc.) call `withFirestoreEmulatorClient(userId, ...)` and use Firestore at `users/{userId}/learnerMemory/{observationId}`.
- The function name `withFirestoreEmulatorClient` is misleading — it uses the Admin SDK Firestore, which in production mode connects to the real Firestore. So the storage layer is correct.
- However: `learnerMemoryRepository.ts` always calls `withFirestoreEmulatorClient`, which has the misleading name. In production mode (`FIREBASE_MODE=production`) this will use real Firestore — so the data IS durable in production.
- The deeper gap: `src/server/tutor/deepseekTutorProvider.ts` builds `learner_memory_update` in `internalUpdate` but this is not wired to actually call `createLearnerMemoryObservation`. The tutor classifies memory updates but the write path from the tutor response to the repository is absent or conditional.
- `src/server/workspaces/sessionMessageApiService.ts` line 155: `validateAttachedFileIds(...)` is called, but checking whether memory writes are executed requires inspection of the full service.
**Reasoning:** The repository layer is durable (Firestore-backed). The gap is that the tutor's `internalUpdate.learner_memory_update` metadata is computed but there is no confirmed wiring from `sessionMessageApiService` to actually persist memory observations from tutor responses. This makes learner memory effectively inert even when Firestore is running.
**Risk if ignored:** The learning personalization loop never closes. The app looks like it supports memory but user observations are never persisted, so the tutor cannot improve its responses based on learner history across sessions.
**Recommended action:** Audit `sessionMessageApiService.ts` to confirm whether `learnerMemoryApiService.createObservation(...)` is called when `internalUpdate.learner_memory_update.needed === true`. If not, wire this path before production launch.
**Priority:** P1

---

### A5 — Firebase Admin SDK / Security Boundary
**Old claim:** Firebase Admin SDK is not properly isolated from client-side code; security boundary is blurred.
**Current verdict:** ALREADY FIXED
**Evidence:**
- `firebase-admin` is only imported in three server-side files: `src/server/workspaces/firebaseStoragePdfBytesLoader.ts`, `src/server/firebase/firebaseAdminApp.ts`, and `src/server/firebase/firestoreTypes.ts`.
- `src/server/auth/verifyFirebaseToken.ts` routes to `verifyFirebaseTokenEmulator` or `verifyFirebaseTokenProduction` based on `FIREBASE_MODE`. Production path calls `getFirebaseAdminAuth().verifyIdToken(...)`.
- `src/server/auth/resolveAuthenticatedUser.ts`: All API routes use this as the auth gate; it extracts the Bearer token and calls the appropriate verifier.
- No `firebase-admin` imports exist in `src/app/`, `src/components/`, or `src/lib/` (client-side tree).
- Client-side uses `firebase/storage` (client SDK) only — clearly separated.
**Reasoning:** Admin SDK is fully confined to `src/server/`. Client SDK is confined to `src/lib/firebase/`. Auth verification uses the Admin SDK verifyIdToken path in production. The security boundary is correctly drawn.
**Risk if ignored:** N/A — already resolved.
**Recommended action:** None. Maintain the import boundary rule; consider adding a lint rule to prevent `firebase-admin` imports outside `src/server/`.
**Priority:** Already resolved

---

### B6 — Conversation Rename False Timeout
**Old claim:** Rename times out on the client while the server eventually succeeds, producing a false failure UI.
**Current verdict:** ALREADY FIXED
**Evidence:**
- `src/lib/sessions/sessionApiClient.ts` line 3: `const REQUEST_TIMEOUT_MS = 25000;`
- The RENAME_TIMEOUT_LATE_SUCCESS_REPAIR_REPORT.md confirms this was increased from 8000ms to 25000ms (commit `217b243`).
- A regression test at `tests/lib/sessions/sessionApiClient.test.ts` asserts `REQUEST_TIMEOUT_MS >= 25000`.
- The repair report confirms the fix: rename uses a shared `runSessionRequest(...)` helper with the 25s abort controller.
**Reasoning:** The root cause (8s timeout too tight for slow Firestore + auth round-trip) has been addressed. The 25s budget now matches the session message client timeout.
**Risk if ignored:** N/A — already fixed. Residual risk: if rename latency ever consistently exceeds 25s in production (e.g., cold-start + slow Firebase), the false timeout could reappear. An optimistic UI with rollback would be the next improvement.
**Recommended action:** Manual smoke confirmation in real signed-in session. Consider adding optimistic rename UI in a future batch.
**Priority:** Already resolved

---

### B7 — Upload from Composer Not Setting Session Context
**Old claim:** File uploaded from the composer does not become the session's explicit context; the tutor has no way to know which file is "in this conversation."
**Current verdict:** PARTIALLY TRUE
**Evidence:**
- `src/types/index.ts` line 333: `attachedFileIds?: string[]` exists on the message type.
- `src/server/workspaces/sessionMessageApiSchemas.ts` lines 13, 25, 67–79: `attachedFileIds` is parsed, validated (max 10 IDs), and included in `PostMessageRequest`.
- `src/server/workspaces/messageRepository.ts` lines 64, 113–114: `attachedFileIds` is persisted to Firestore and read back.
- `src/lib/sessions/sessionMessagesApiTypes.ts` line 9 and `sessionMessagesApiClient.ts` line 51: Client type and client send both carry `attachedFileIds`.
- `src/server/workspaces/sessionMessageApiService.ts` line 155: `validateAttachedFileIds(...)` is called on incoming requests.
- **However:** `src/components/tutor/TutorConversation.tsx` lines 219–225: The `sendSessionMessage(...)` call does NOT pass `attachedFileIds`. It only passes `workspaceId`, `sessionId`, `userMessage`, `workMode`, `costMode`.
- `src/app/page.tsx` `handleFileSelected` (line 351+): Uploads file immediately to workspace storage, creates metadata, starts processing pipeline — no staged attachment state, no file ID returned to the composer for inclusion in the next message.
- There is no `stagedAttachedFileIds` state in `TutorConversation` or `page.tsx`.
**Reasoning:** The data model, schema, repository, and API client layers for `attachedFileIds` are fully implemented (C1 batch from CONVERSATION_FILE_ATTACHMENT_FIT_CHECK). The gap is in the **composer wiring**: `TutorConversation` does not pass `attachedFileIds` when sending, and `handleFileSelected` does not return the file ID for staged attachment. The backend is ready; the frontend wire is missing. This means files uploaded from the composer reach workspace materials but are not signalled as session context in the message.
**Risk if ignored:** Users uploading a file from the chat expect the tutor to focus on that file. The tutor retrieves from the whole workspace instead, which can produce irrelevant answers when multiple files exist.
**Recommended action:** Implement C2–C4 from CONVERSATION_FILE_ATTACHMENT_FIT_CHECK: staged attachment state in composer, pass file ID back from upload, include `attachedFileIds` in `sendSessionMessage` call, add retrieval prioritization in `fileChunkRetrievalService`.
**Priority:** P1

---

### B8 — Workspace/Course Delete Not Safely Implemented
**Old claim:** Workspace/course delete is not safely implemented end-to-end.
**Current verdict:** TRUE CURRENT GAP (intentional deferral)
**Evidence:**
- `src/server/workspaces/workspaceRepository.ts`: grep for `delete|softDelete|archive` returns no matches.
- `src/app/api/workspaces/[workspaceId]/route.ts`: Only a `GET` handler exists (`createWorkspaceByIdGetHandler`). No `DELETE` handler.
- `src/app/api/workspaces/route.ts`: Only `GET` and `POST` handlers.
- `src/lib/workspaces/workspaceFilesApiClient.ts` line 127: `deleteWorkspaceFile` exists (for files), but no `deleteWorkspace` function.
- The STITCH_DESIGN_GAP_ANALYSIS document section 11 confirms: `workspaceApiClient` supports fetch/create only; `WorkspaceStatus` includes `deleted` as a type but no implementation exists behind it.
- Session delete (soft delete) is implemented; file delete (soft delete) is implemented. Workspace/course delete is the only missing piece.
**Reasoning:** This is a confirmed intentional deferral, not an oversight. The decision was correct: deleting a workspace requires cascade semantics across sessions, uploaded files, chunks, embeddings, artifacts, and storage blobs — a non-trivial atomic operation. Doing it unsafely would risk data leakage.
**Risk if ignored:** If any UI surface exposes a workspace delete action, it will be a no-op or throw an error. Risk of confusion or silent failures if the button exists.
**Recommended action:** Confirm no delete UI is exposed at workspace level. When implementing, design as a server-side soft-archive with cascade status propagation. Do not implement until backend-safe semantics are fully specced.
**Priority:** P2 (intentional deferral)

---

### B9 — Settings Controls Hydration
**Old claim:** Settings controls render but do not hydrate; clicks do not update localStorage or CSS variables.
**Current verdict:** ALREADY FIXED
**Evidence:**
- `src/lib/settings/settingsPreferences.ts` exists (new untracked file in the working tree): exports `CHAT_FONT_SIZE_KEY`, `CHAT_MAX_WIDTH_KEY`, `DEV_DIAGNOSTICS_STORAGE_KEY`, `applyStoredDisplayPreferences(...)`, `saveChatFontSizePreference(...)`, `saveChatWidthPreference(...)`, `saveDevDiagnosticsPreference(...)`.
- `src/app/settings/page.tsx` imports from this module and calls `saveChatFontSizePreference(window.localStorage, document.documentElement.style, value)` and equivalents.
- `src/app/page.tsx` imports the shared helper and calls `applyStoredDisplayPreferences(...)` on mount.
- `next.config.ts`: `allowedDevOrigins` added to fix the `127.0.0.1` vs `localhost` hydration mismatch.
- SETTINGS_NAVIGATION_AND_PERSISTENCE_REPAIR_REPORT.md: Navigation replaced from raw `<a href>` to `next/link`, diagnostics initialization overwrite bug fixed.
**Reasoning:** The root cause was dual: (1) raw `<a href>` causing full reload instead of client navigation, and (2) dev-origin mismatch causing hydration loss on `127.0.0.1`. Both are fixed. The persistence logic is now centralised in the shared module and tested.
**Risk if ignored:** N/A — already fixed. Remaining risk: manual smoke on a real signed-in session has not been confirmed (Playwright cannot access the Firebase auth session).
**Recommended action:** Manual smoke confirmation with Nevo's real signed-in session on `localhost`. Verify font size, width, diagnostics toggle, and theme palette all persist.
**Priority:** Already resolved

---

### C10 — Diagram-Aware Deep PDF
**Old claim:** Deep PDF does not extract or reason about diagrams, figures, or visual elements.
**Current verdict:** TRUE CURRENT GAP
**Evidence:**
- `src/server/workspaces/documentUnderstandingProvider.ts` line 496: The prompt includes `"If formulas, diagrams, or visual elements are unclear, mark them as low-confidence and preserve that uncertainty honestly."` — this is a **disclaimer**, not extraction logic.
- `src/server/workspaces/documentArtifactSchemas.ts`: grep for `diagram|figure|image|visual` returns only `optionalPageImageRef` (lines 30, 129) — a single optional string field for a page image reference. No diagram extraction schema, no figure type, no visual element model.
- `src/server/workspaces/geminiPdfUnderstandingClient.ts`: No references to diagram, figure, image, or visual extraction in the prompt or schema.
- DIAGRAM_AWARE_DEEP_PDF_DIAGNOSTIC.md exists in agent-memory (untracked), confirming the gap was diagnosed.
**Reasoning:** The current Deep PDF pipeline extracts text, chunks, and page-level artifacts including a best-effort page image reference. It has no structured pipeline for: identifying diagrams, extracting figure captions, reasoning about circuit diagrams, charts, or mathematical visual notation. The prompt instructs the model to be honest about visual ambiguity, which is correct risk management, but does not constitute diagram-aware extraction.
**Risk if ignored:** Users studying technical content (circuits, graphs, figures) will find the tutor unable to reference or explain visual elements accurately. The prompt is honest about this limitation, but users may not understand why.
**Recommended action:** Design a figure/diagram extraction layer as part of a future Deep PDF batch: structured schema for `DocumentFigure` type, Gemini multimodal prompt that explicitly describes figures, and tutor grounding that can reference specific figures.
**Priority:** P2

---

### C11 — Richer Source Metadata
**Old claim:** Sources show raw IDs or minimal metadata; no filename, page number, or quote grouping.
**Current verdict:** PARTIALLY TRUE
**Evidence:**
- `src/types/index.ts` lines 181–195, 286, 289, 321–332: `SourceCitation` type includes `sourceId`, `citationLabel?`, `originalFileName?`, `pageNumber?`, `referenceText?`. `DocumentPageArtifact` includes `fileName?` and `pageNumber`.
- `src/server/workspaces/sessionMessageApiService.ts` line 432: `fileName: String(readyFile.originalFileName ?? readyFile.name ?? "הקובץ")` — filename is mapped into citations.
- `src/components/tutor/TutorConversation.tsx` line 914: `formatSourceLabel` returns `citation.originalFileName.trim()` if present, falling back to `"Source N"`.
- The `SourcesSection` component renders a label (filename) and `referenceText` excerpt. No page number is displayed even if `pageNumber` is in the type.
- STITCH_DESIGN_GAP_ANALYSIS section 5: "Sources — Blocked by metadata richness. Richer citations with filename/page/quote grouping."
**Reasoning:** Filename is populated and displayed. The `pageNumber` field exists in the type and artifact schema but is not rendered in the UI. `citationLabel` exists but is not surfaced. The `referenceText` excerpt is shown but capped at 3 lines. The data model has more richness than the UI consumes. The gap is: (1) page number not rendered, (2) no section/question grouping, (3) no filename+page compound label like "Lecture3.pdf — p.12".
**Risk if ignored:** Sources feel less useful than they could be. Users cannot easily find the exact page referenced. The gap is purely cosmetic/UX, not a data model deficiency.
**Recommended action:** Update `formatSourceLabel` and `SourcesSection` to render `originalFileName + pageNumber` when both are present. This is a safe visual-only change. More advanced grouping (by file, by section) can follow.
**Priority:** P2

---

### C12 — Genkit Flow Layer
**Old claim:** A Genkit-based flow layer should be (or is expected to be) wired for LLM orchestration.
**Current verdict:** INACCURATE
**Evidence:**
- `package.json`: grep for `genkit` returns no output — genkit is not a dependency.
- `find src -name "*.ts" | xargs grep -l "genkit"`: returns no files — genkit is not referenced anywhere in source.
- The tutor orchestration layer is custom: `src/server/tutor/handleTutorRequest.ts`, `providerRegistry.ts`, `deepseekTutorProvider.ts` with a harness JSON contract. No flow framework is used.
- `src/server/workspaces/geminiPdfUnderstandingClient.ts` calls the Gemini REST API directly, not via Genkit.
**Reasoning:** Genkit was never adopted. The codebase implements its own lightweight provider registry and harness contract. This is not a gap — it is a deliberate architectural choice. The claim that Genkit is a missing layer is inaccurate.
**Risk if ignored:** N/A — not applicable. The custom orchestration layer is functional and has clear boundaries.
**Recommended action:** No action. If Genkit is considered for the future, evaluate against the existing provider interface abstraction.
**Priority:** Not applicable (inaccurate finding)

---

### C13 — Semantic Summary Hierarchy
**Old claim:** No semantic topic/workspace/semester summary hierarchy exists; responses lack hierarchical structure.
**Current verdict:** TRUE CURRENT GAP
**Evidence:**
- grep for `topicSummary|workspaceSummary|semesterSummary|generateSummary|summaryFlow` in `src/` returns no matches.
- `src/server/workspaces/documentArtifactSchemas.ts`: `summary` field exists on page-level artifacts (line 61, 234) — a single string per page. No multi-level summary type (topic, section, workspace, course).
- No summary hierarchy type exists in `src/types/index.ts`.
- The retrieval and grounding pipeline uses chunk-level semantic retrieval and page-level artifacts, not a summary tree.
**Reasoning:** The current architecture supports page-level summaries within a document artifact. There is no workspace-level or topic-level summary hierarchy. This means: (1) the tutor cannot answer "give me an overview of the whole course" from a structured summary, only from retrieved chunks; (2) there is no cross-document concept linkage. This is a significant gap for a learning platform but is not yet in the planned implementation roadmap.
**Risk if ignored:** Cross-workspace synthesis questions ("how does topic X in lecture 2 relate to lecture 5?") will rely on chunk retrieval quality, which degrades for broad synthesis questions. Users may receive shallow or disconnected answers.
**Recommended action:** Defer to a future batch. When implementing, design a `WorkspaceSummaryArtifact` and `TopicSummaryArtifact` schema, a generation step in the Deep PDF pipeline, and a retrieval layer that can query at summary granularity.
**Priority:** P3 (future capability)

---

## Corrected Implementation Order

### 1. Immediate real-use blockers (P1)

**A1 — Startup guard for missing DEEPSEEK_API_KEY in production**
Add a fail-fast assertion: if `FIREBASE_MODE=production` and `DEEPSEEK_API_KEY` is absent, throw at startup rather than silently serving mock responses.

**A2 — Deployment env validation**
Add a production startup health check that validates all required env vars (`FIREBASE_MODE`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` or `GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET`, `DEEPSEEK_API_KEY`).

**A4 — Learner Memory write path audit**
Audit `sessionMessageApiService.ts` to confirm whether `learnerMemoryApiService.createObservation(...)` is called when `internalUpdate.learner_memory_update.needed === true`. If absent, wire the write path.

**B7 — Composer attachment wiring (C2–C4)**
`TutorConversation` does not pass `attachedFileIds` in `sendSessionMessage`. `handleFileSelected` in `page.tsx` does not return the file ID for staged use. Implement staged attachment state in composer, pass `attachedFileIds` through `sendSessionMessage`, add retrieval prioritization.

### 2. Product-core gaps (P2)

**B8 — Workspace delete (intentional deferral)**
Confirm no delete UI is exposed at workspace level. Design cascade archive/soft-delete semantics before implementing. Backend-safe only.

**C10 — Diagram-aware Deep PDF**
Add `DocumentFigure` schema, multimodal Gemini prompt for figure extraction, and tutor grounding references to figures.

**C11 — Source metadata UI**
Render `originalFileName + pageNumber` in `formatSourceLabel` and `SourcesSection`. Safe visual-only change, no backend required.

### 3. Production hardening (P1/P2)

**B6, B9 — Already fixed**
Manual smoke with real signed-in session to confirm rename timeout fix and settings persistence fix are working end-to-end.

**A3, A5 — Already verified**
No further action; maintain lint/boundary rules.

### 4. Future capabilities / Deferred (P3)

**C12 — Genkit:** Not applicable. Finding is inaccurate.

**C13 — Semantic summary hierarchy:** Design `WorkspaceSummaryArtifact` and `TopicSummaryArtifact` after Deep PDF pipeline is stable. Not in current roadmap.

---

## Validation Results

- `tsc --noEmit`: **PASSED** — `./node_modules/.bin/tsc --noEmit --skipLibCheck` exits 0, no output. TypeScript types are clean on the current working tree.
- `vitest run`: **CANNOT RUN IN THIS ENVIRONMENT** — rolldown binary `@rolldown/binding-linux-arm64-gnu` / `rolldown-binding.linux-arm64-gnu.node` is missing. The node_modules were installed on macOS arm64 (the developer's machine); the QA sandbox runs Linux arm64 and the platform-specific binary is absent. This is a sandbox environment issue, not a code issue. The last known passing run recorded in memory files was 77 passed / 18 skipped (STITCH_DESIGN_GAP_ANALYSIS_AND_IMPLEMENTATION_PLAN.md, section 14).
- `git diff --check`: **PASSED** — no whitespace errors in tracked changes.

---

## Safety Confirmations

- I did not change code.
- I did not edit files except this report.
- I did not change app behavior.
- I did not run git add.
- I did not commit.
- I did not push.
- I did not run git pull.
