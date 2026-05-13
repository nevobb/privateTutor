# Decision Log

## Technical/Product Decisions Made

### 1. Framework Selection
**Decision:** Used Next.js with App Router, TypeScript, and Tailwind CSS.
**Rationale:** Provides a robust, standard foundation for a responsive web app.

### 2. Type Segregation
**Decision:** Kept `AcademicKnowledgeItem` strictly separate from `LearnerMemory`.
**Rationale:** Core product principle. Prevents subjective student performance metrics from polluting objective facts.

### 3. Mock Flow Architecture
**Decision:** Abstracted the LLM integration into a mock `getMockTutorResponse` function.
**Rationale:** Adheres strictly to the "Do not connect Gemini yet" rule for stabilization.

### 4. UI Layout Direction (RTL)
**Decision:** Fixed grid layout with Materials panel on the right and Memory on the left.
**Rationale:** Follows native Hebrew RTL reading patterns for research environments.

### 5. Security - Type Hardening
**Decision:** Removed `apiKey` from `ProviderSettings` interface.
**Rationale:** Prevent accidental leakage or storage of sensitive secrets in type structures during mock phases.

### 6. Firebase Emulator First
**Decision:** Use Firebase Emulator first before cloud/runtime Firebase connection.
**Rationale:** Protect security, validate rules and data model locally, and avoid premature cloud coupling.
**Scope:** Firebase Authentication, Firestore, and Firebase Storage preparation.
**Status:** Accepted by Nevo.

### 7. Firebase Auth Boundary Before Broader Runtime Integration
**Decision:** Implement Firebase Authentication runtime integration as a narrow boundary before Firestore, Storage, Gemini, Genkit, retrieval, or learner memory persistence.
**Rationale:** Establishes trusted user identity before any user-scoped data or provider behavior can become durable.
**Scope:** Client auth state, server token verification, and trusted `userId` derivation for protected routes.
**Status:** Planned.

### 9. DecisionLog Emulator-Phase Write Policy
**Decision:** Allow owner create + read for `users/{userId}/decisionLog/{entryId}` in Firestore rules during the emulator phase. Deny update and delete (append-only). Defer strict client-deny hardening until Firebase Admin SDK is available.
**Rationale:** The ownership planning document specifies decisionLog as logically server-owned and client-inaccessible. However, the current persistence implementation uses the Firebase Web SDK (no Admin SDK). Enforcing client-deny now would break `workspacePersistence.emulator.test.ts`. The emulator-phase approach keeps the tests passing while preserving append-only semantics. Production hardening (deny all client writes, use server-side Admin SDK) is explicitly documented and deferred.
**Scope:** Firestore rules for `users/{userId}/decisionLog/{entryId}` only. Does not affect Auth boundary, tutor provider, Storage, Gemini, or Genkit.
**Status:** Accepted for emulator phase. Production hardening deferred.

### 8. Workspace Persistence Before Broader Integrations
**Decision:** Implement workspace persistence boundaries before Storage upload, Gemini/Genkit integration, retrieval integration, and learner memory persistence.
**Rationale:** Durable workspace/session/message ownership and write ordering must be stable before adding higher-risk integrations.
**Scope:** Workspace, session, message, and decision-log persistence boundaries in emulator-first mode.
**Status:** Accepted by Nevo.

### 10. UI Chrome Is English/LTR; Hebrew Appears Only Inside Chat Message Bubble Content
**Decision:** The application chrome (toolbar labels, mode selectors, sidebar items, settings) is rendered in English with LTR layout. Hebrew text appears only inside chat message bubble content, using `dir="auto"` on the bubble content container so the browser auto-detects text direction per message.
**Rationale:** Nevo explicitly requested an LTR layout with English labels for the chrome. Hebrew content auto-detects correctly via `dir="auto"` on bubble content without requiring a global RTL layout. This avoids RTL-specific CSS conflicts in the toolbar and sidebar that would arise from a full `dir="rtl"` document.
**Date:** 2026-05-14
**Overrides:** AGENTS.md §3 which stated "Hebrew RTL UI" as the default architecture. That default is superseded by this explicit product decision for the current UI design.
