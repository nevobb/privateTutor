# Step 28B Firebase Production Mode Report

## Branch
- Branch: step28b-production-firebase-mode
- Base: main

## Implementation
- Runtime mode config:
  - Added `src/lib/firebase/firebaseRuntimeMode.ts` (`NEXT_PUBLIC_FIREBASE_MODE`)
  - Added `src/server/firebase/firebaseServerRuntimeMode.ts` (`FIREBASE_MODE`)
- Client Firebase:
  - `src/lib/firebase/firebaseClientApp.ts` now supports explicit emulator vs production config.
  - Emulator mode keeps demo config + Auth/Storage emulator connections.
  - Production mode requires `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`.
- Server auth:
  - Added `src/server/auth/verifyFirebaseTokenProduction.ts` using Admin `verifyIdToken`.
  - `src/server/auth/verifyFirebaseToken.ts` now selects emulator vs production verifier by mode.
- Server Firestore:
  - Added Admin app boundary `src/server/firebase/firebaseAdminApp.ts`.
  - `src/server/firebase/firestoreEmulatorClient.ts` now returns admin Firestore client, with emulator reachability check only in emulator mode.
  - Workspace/session/message/file/memory/decision/chunk repositories now operate over admin-backed DB methods.
- Storage:
  - Client storage path remains unchanged.
  - Storage emulator connection runs only in emulator mode.
- Auth UX:
  - Added visible signed-in user identity (display name/email) and mode label in sidebar.
  - Added sign-out button in sidebar.
- Docs/env:
  - Updated `.env.local.example` with emulator/production placeholders.
  - Added `docs/FIREBASE_PRODUCTION_SETUP.md`.

## Package approval
- Needed: yes
- Package: firebase-admin
- Approved: yes
- Installed: yes

## Validation
- npm run build: passed
- targeted tests:
  - `tests/server/workspaces/sessionMessageApiService.test.ts` passed
  - `tests/server/workspaces/fileChunkRetrievalService.test.ts` passed
  - `tests/server/workspaces/fileChunkSemanticRetrievalService.test.ts` passed
- auth/firebase tests:
  - `tests/server/auth/verifyFirebaseToken.test.ts` passed
  - `tests/server/auth/verifyFirebaseTokenProduction.test.ts` passed
  - `tests/server/firebase/firestoreEmulatorClient.test.ts` passed
  - `tests/server/auth/authBoundary.test.ts` passed
- emulator manual smoke: pending (not executed in this task)
- production manual smoke: pending Nevo local production env + ADC setup
- git diff --check: passed
- gitleaks --no-git: pending run in this task
- gitleaks history: pending run in this task

## Production setup status
- Firebase project: required from Nevo local setup
- Google sign-in: required in Firebase Console
- Web config: required in `.env.local`
- Admin credentials: required via `GOOGLE_APPLICATION_CREDENTIALS` or ADC (`FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` optional fallback)
- Firestore: required in target Firebase project
- Storage: required in target Firebase project
- Remaining Nevo actions:
  - Populate production env vars locally
  - Provide local ADC/service-account path (not committed)
  - Run production mode smoke checklist

## Files changed
- package.json
- package-lock.json
- .env.local.example
- docs/FIREBASE_PRODUCTION_SETUP.md
- src/lib/firebase/firebaseRuntimeMode.ts
- src/lib/firebase/firebaseClientApp.ts
- src/server/firebase/firebaseServerConfig.ts
- src/server/firebase/firestoreTypes.ts
- src/server/firebase/firebaseServerRuntimeMode.ts
- src/server/firebase/firebaseAdminApp.ts
- src/server/firebase/firestoreEmulatorClient.ts
- src/server/auth/verifyFirebaseToken.ts
- src/server/auth/verifyFirebaseTokenProduction.ts
- src/server/workspaces/workspaceRepository.ts
- src/server/workspaces/sessionRepository.ts
- src/server/workspaces/messageRepository.ts
- src/server/workspaces/uploadedFileRepository.ts
- src/server/workspaces/learnerMemoryRepository.ts
- src/server/workspaces/decisionLogRepository.ts
- src/server/workspaces/fileChunkRepository.ts
- src/server/workspaces/fileChunkEmbeddingRepository.ts
- src/app/page.tsx
- tests/server/auth/verifyFirebaseToken.test.ts
- tests/server/auth/verifyFirebaseTokenProduction.test.ts
- tests/server/firebase/firestoreEmulatorClient.test.ts
- agent-memory/CURRENT_TASK.md
- agent-memory/AGENT_HANDOFF.md
- agent-memory/TASK_LOG.md
- agent-memory/PROJECT_STATE.md
- agent-memory/DUAL_AGENT_SYNC_LOG.md
- agent-memory/FIREBASE_PRODUCTION_MODE_REPORT.md

## Risks / limitations
- Manual production smoke is not yet executed in this task.
- Existing repository layer now depends on admin-backed Firestore paths; behavior parity validated by build+focused tests, but broad emulator integration suite was not fully rerun yet.

## Recommendation
- PUSH CONDITIONAL

## Push recommendation requested
Ask Nevo/ChatGPT for PUSH APPROVED / PUSH BLOCKED / PUSH CONDITIONAL.
