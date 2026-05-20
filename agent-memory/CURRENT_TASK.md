# Current Task

## Active task
Step 28B — Firebase production mode + real user identity foundation.

## Status
Implemented on branch `step28b-production-firebase-mode` (not pushed).

## What was implemented
- Added explicit client/server runtime modes:
  - `NEXT_PUBLIC_FIREBASE_MODE=emulator|production`
  - `FIREBASE_MODE=emulator|production`
- Added server Firebase Admin boundary (`firebase-admin`) for production-safe token verification and Firestore access.
- Added production verifier path (`verifyIdToken`) and mode-based verifier selection.
- Migrated server Firestore repository access to admin-backed document/query operations while preserving existing user-owned paths.
- Added production-capable client Firebase config from `NEXT_PUBLIC_FIREBASE_*` env vars.
- Kept emulator behavior active in emulator mode (Auth/Storage emulators on client; Firestore emulator reachability check on server).
- Added signed-in identity visibility (name/email/mode) + sign-out action in sidebar.
- Updated `.env.local.example` placeholders and added `docs/FIREBASE_PRODUCTION_SETUP.md`.

## Explicit boundaries preserved
- No preferences persistence implementation.
- No session rename/delete/archive implementation.
- No runtime mock cleanup implementation.
- No parser/retrieval/embedding feature expansion.
- No push.

## Validation executed
- `npm run build` ✅
- `npx vitest run tests/server/auth/verifyFirebaseToken.test.ts tests/server/auth/verifyFirebaseTokenProduction.test.ts tests/server/firebase/firestoreEmulatorClient.test.ts tests/server/auth/authBoundary.test.ts tests/server/workspaces/sessionMessageApiService.test.ts tests/server/workspaces/fileChunkRetrievalService.test.ts tests/server/workspaces/fileChunkSemanticRetrievalService.test.ts` ✅

## Recommended next step
Manual smoke in both modes:
1. Emulator smoke with `Start Tutor.command`.
2. Production smoke with real Firebase web config + ADC credentials.
