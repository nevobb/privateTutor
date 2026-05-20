# Step 28A Personal Use Readiness Audit

## Current branch/state
- Branch: `main`
- HEAD: `03d41ab` (`feat: render math and latex in chat`)
- Working tree: clean (`git status --short` empty)

## Firebase mode audit
- Current mode:
  - Client Firebase app is demo-hardcoded for project/auth domain (`demo-private-tutor`) in `src/lib/firebase/firebaseClientApp.ts`.
  - Client auth always calls `connectAuthEmulator(...)`.
  - Client storage always calls `connectStorageEmulator(...)`.
  - Server Firestore client is emulator-only (`withFirestoreEmulatorClient`) with hardcoded local host/port/project in `src/server/firebase/*`.
  - Server token verification is emulator-only (`verifyFirebaseToken -> verifyFirebaseTokenEmulator`).
- Emulator dependencies:
  - `firebase.json` defines emulator ports and single-project emulator mode.
  - `authEmulatorConfig` and `firestoreServerConfig` are hardcoded to demo emulator values.
- Production readiness:
  - Not production-ready yet. Runtime path is explicitly emulator-first.
- Required env variables (for production mode switch):
  - Client public Firebase config:
    - `NEXT_PUBLIC_FIREBASE_API_KEY`
    - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
    - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
    - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
    - optional: `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - Server auth verification mode switch:
    - `FIREBASE_AUTH_MODE=emulator|production`
    - production needs Firebase Admin credentials path or ADC strategy.
  - Server Firestore mode switch:
    - `FIRESTORE_MODE=emulator|production`
    - production needs Admin SDK initialization.
- Required Firebase console setup:
  - Real Firebase project.
  - Authentication (Google provider enabled, authorized domains set).
  - Firestore database created in production mode.
  - Storage bucket configured.
  - Web app registration for client config values.
- Risks:
  - If switched partially (client only, server still emulator), auth and API will fail.
  - If rules are deployed as-is without migration checks, write surface may be broader than desired.

## User data persistence audit
- Workspaces:
  - Stored under `users/{userId}/workspaces/{workspaceId}`.
- Sessions:
  - Stored under `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}`.
- Messages:
  - Stored under `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}/messages/{messageId}`.
- Files:
  - Metadata stored under `users/{userId}/uploadedFiles/{fileId}` with `workspaceId` field linkage.
  - Storage path convention enforces `users/{userId}/workspaces/{workspaceId}/files/{fileId}/{fileName}`.
- Chunks:
  - Stored under `users/{userId}/workspaces/{workspaceId}/files/{fileId}/chunks/{chunkId}`.
- Embeddings:
  - Stored under `users/{userId}/workspaces/{workspaceId}/files/{fileId}/chunks/{chunkId}/embedding/current`.
- Learner memory:
  - Stored under `users/{userId}/learnerMemory/{observationId}`.
- Decision log:
  - Stored under `users/{userId}/decisionLog/{entryId}`.
- UI preferences:
  - No server persistence currently.
  - Current state uses localStorage only (Theme + diagnostics toggle + sidebar collapse).
  - Recommended path: `users/{userId}/preferences/ui` (aligned with existing user-rooted model and rules style).

## Auth UX audit
- Current sign-in:
  - Google sign-in via client SDK popup (`signInWithPopup`), wrapped by `AuthShell`.
- User email/name visibility:
  - Sidebar shows avatar letter and tooltip label from `displayName` or `email`.
- Production Google sign-in readiness:
  - UI flow is reusable.
  - Runtime backend verification is not production-ready because token verification is emulator-only.
- Problems:
  - No explicit sign-out control in visible UI flow.
  - No visible "connected as <email>" indicator text (only implicit avatar tooltip).
  - Emulator-only auth wiring can cause silent confusion in real mode attempts.
- Recommended changes:
  - Add mode-safe auth boundary with explicit emulator/production switch.
  - Add user identity chip in sidebar: full display name/email and sign-out action.
  - Add startup mode banner in dev/personal mode to avoid ambiguity.

## UI preferences plan
- Storage path:
  - `users/{userId}/preferences/ui`
- Fields:
  - `themePreset`: string (`navy|sage|...`)
  - `themeOverrides`: map of CSS variables
  - `textSize`: enum (`sm|md|lg|xl`) or numeric scale
  - `lineWidth`: enum (`narrow|normal|wide`) or max-width px token
  - `updatedAt`: timestamp
- API/client changes needed:
  - Add `GET /api/preferences/ui` and `PATCH /api/preferences/ui`.
  - Add `uiPreferencesRepository` under `src/server/workspaces` (or `src/server/preferences`) using user-owned path.
  - Add client API module in `src/lib/preferences`.
- UI changes needed:
  - `ThemePicker` should hydrate from server-backed preference after auth, then sync updates.
  - Add controls for text size + line width in settings area.
- CSS variable strategy:
  - Add new vars on `:root`:
    - `--tutor-font-scale`
    - `--tutor-chat-max-width`
  - Apply scale in core text containers and chat bubble width constraints.

## Session rename plan
- Current support:
  - Session has `title` field in schema and repository.
  - No endpoint exists to update a session title.
  - No UI action to rename sessions.
- Schema changes:
  - Add `PATCH /api/sessions/[sessionId]` input: `{ workspaceId, title }` (validated non-empty).
- API changes:
  - Add repository method to update session title + `updatedAt` only.
  - Ensure ownership and workspace membership checks remain strict.
- UI changes:
  - Add rename action in session list row (inline edit or simple dialog).
- Tests needed:
  - Schema validation tests (empty title, too long, missing workspaceId).
  - Service route tests for 401/404/400/200.
  - Verify `lastActiveAt` sorting logic remains unaffected (rename should not mutate `lastActiveAt`).

## Session delete/archive plan
- Current support:
  - No delete/archive endpoint for sessions.
  - `SessionStatus` type includes `archived`, but not operationalized in list filtering or API actions.
- Recommended MVP behavior:
  - Soft archive first (safer for personal-study history).
  - Optional separate soft delete state later.
- Schema changes:
  - Extend persisted session fields with:
    - `status: active | archived | deleted`
    - optional `archivedAt`, `deletedAt`
- API changes:
  - Add `PATCH /api/sessions/[sessionId]` action-based status updates or dedicated archive/delete routes.
  - Default list endpoint returns only `status=active` unless explicit filter passed.
- UI changes:
  - Add archive/delete action in session list overflow menu.
  - Add archived view/filter if needed in later phase.
- Tests needed:
  - Route/service coverage for archive/delete transitions.
  - List filtering tests ensuring archived/deleted sessions disappear from default list.

## Runtime mock data audit
- Runtime mocks to remove later:
  - Tutor mock provider fallback paths (`src/server/tutor/mock*`, `src/lib/tutor.ts`) still active fallback behavior.
  - UI placeholder copy: `Sources: not connected yet` in `TutorConversation` context strip.
- Test mocks to keep:
  - Unit/integration mocks under `tests/**` and deterministic test doubles.
- Placeholder copy to revise:
  - Retrieval/source strip copy and legacy docs strings that imply missing integrations when real mode is enabled.
- Safe deterministic providers to keep:
  - Deterministic embedding/test providers for CI and fallback safety in non-production/test environments.

## Security checklist
- Firestore rules:
  - Owner-scoped model is good baseline (`users/{userId}/...`).
  - Current rules permit broad write on several subcollections; production hardening should narrow where possible.
- Storage rules:
  - Owner-scoped and explicitly flagged as "not production-ready" in comments.
  - Missing MIME/size enforcement at rule layer.
- Auth verification:
  - Emulator-only verifier currently; production auth verification not wired.
- Secrets:
  - `.env*` ignored in git.
- Gitleaks:
  - `--no-git` finds only local `.env.local` and `.next/*` paths.
  - History scan clean.
- Public repo risk:
  - High if someone assumes current setup is production-ready due mixed completed feature docs.
  - Mitigate by explicit production-mode checklist and guardrails before Step 28B rollout.

## Recommended implementation order
1. Production Firebase mode switch + env separation (client+server together).
2. Production auth verification (Admin SDK path) + explicit identity/sign-out UX.
3. UI preferences API + persistence to `users/{userId}/preferences/ui`.
4. Text size + line width controls wired to persisted preferences.
5. Session rename endpoint + UI action.
6. Session archive/delete (soft delete MVP) + filtered list behavior.
7. Runtime mock/placeholder cleanup for personal-study mode.
8. Real Study Trial (Nevo-only) with rollback checklist.

## Open decisions for Nevo
- Soft archive only in MVP, or soft delete too in same milestone?
- Switch to production Firebase now, or one more structured emulator trial after preference/session controls?
- Text size presets: 3 levels (`sm|md|lg`) vs 4 levels (`sm|md|lg|xl`)?
- Line width presets: `narrow|normal|wide` vs numeric slider?
- Should session archive be reversible in UI in Step 28B scope?

## Recommendation
- NEEDS DECISION FROM NEVO

Final line:
Ask Nevo/ChatGPT for approval before implementation.
