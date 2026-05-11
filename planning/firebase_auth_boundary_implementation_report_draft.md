# Firebase Auth Boundary Implementation Report Draft

## What was implemented

- Server auth helper modules.
- `POST /api/tutor` auth protection.
- Spoofed `userId` rejection.
- Minimal standalone client `AuthShell` boundary.
- Focused auth helper and route tests.

## What remains mock-only

- Tutor response generation.
- Workspace/file/memory/knowledge data.
- Decision log persistence.
- Temporary Chat persistence behavior.

## What was not implemented

- Firebase Admin verification.
- Auth Emulator token verification.
- Firestore persistence.
- Storage upload.
- Gemini.
- Genkit.
- Retrieval.
- Learner memory persistence.
- Real Firebase project config.
- Env files or secrets.

## Dependency decision

No package dependency changes were needed. The `AuthShell` does not import Firebase runtime SDKs, and server token verification is injectable.

The existing `firebase` package remains a dev dependency from rules testing.

## Testing summary

- `npm run build` passed.
- `npm run lint` passed.
- `npx vitest run` passed.
- `npm run test:firebase:rules` was attempted. It passed earlier while local emulators were running, and the final rerun failed with `ECONNREFUSED 127.0.0.1:8080` because the Firestore emulator was not running.
- `git diff --check` passed.
