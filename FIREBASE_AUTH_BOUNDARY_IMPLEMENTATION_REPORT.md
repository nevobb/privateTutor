# Firebase Auth Boundary Implementation Report

## 1. Branch used

`feat/firebase-auth-boundary`

## 2. Subagents used

- Writer Subagent A: Server auth boundary and route protection.
- Writer Subagent B: Client auth shell boundary.
- Writer Subagent C: Auth tests.
- Writer Subagent D: Documentation/report draft.
- Reviewer Subagent E: Security reviewer.
- Reviewer Subagent F: Integration reviewer.

## 3. File ownership map

- Writer A: `src/server/auth/*`, `src/app/api/tutor/route.ts`
- Writer B: `src/lib/firebase/*`, `src/components/auth/AuthShell.tsx`
- Writer C: `tests/server/auth/*`, route-auth test updates
- Writer D: `docs/firebase/AUTH_BOUNDARY_IMPLEMENTATION.md`, `planning/firebase_auth_boundary_implementation_report_draft.md`
- Main Codex: `FIREBASE_AUTH_BOUNDARY_IMPLEMENTATION_REPORT.md`, `PROJECT_STATE.md`, `NEXT_STEPS_FOR_NEVO.md`

## 4. Files added

- `src/server/auth/authTypes.ts`
- `src/server/auth/extractBearerToken.ts`
- `src/server/auth/verifyFirebaseToken.ts`
- `src/server/auth/resolveAuthenticatedUser.ts`
- `src/server/auth/assertRequestUserMatchesAuthUser.ts`
- `src/lib/firebase/clientAuthTypes.ts`
- `src/lib/firebase/clientAuthBoundary.ts`
- `src/components/auth/AuthShell.tsx`
- `tests/server/auth/authBoundary.test.ts`
- `tests/server/auth/tutorRouteAuth.test.ts`
- `docs/firebase/AUTH_BOUNDARY_IMPLEMENTATION.md`
- `planning/firebase_auth_boundary_implementation_report_draft.md`
- `FIREBASE_AUTH_BOUNDARY_IMPLEMENTATION_REPORT.md`

## 5. Files changed

- `src/app/api/tutor/route.ts`
- `tests/server/tutor.handler.test.ts`
- `PROJECT_STATE.md`
- `NEXT_STEPS_FOR_NEVO.md`

## 6. Dependencies changed, if any

No package dependencies changed.

The existing `firebase` package remains a dev dependency from Firebase rules testing because this PR does not import Firebase runtime SDKs.

## 7. Server auth boundary summary

Server auth helpers extract Bearer tokens, resolve authenticated users through an injectable verifier, and reject missing, malformed, invalid, or unverifiable auth with `401`.

The default verifier fails closed because Firebase Admin/cloud verification is intentionally not configured.

## 8. Route protection summary

`POST /api/tutor` now requires auth, rejects spoofed body `userId` with `403`, injects trusted authenticated `uid` for the current tutor schema, and then calls the existing mock tutor handler.

## 9. Client AuthShell summary

A standalone Hebrew RTL `AuthShell` boundary exists with loading, signed-out, signed-in, and auth-error states.

It is not wired into the visible app and does not import Firebase runtime SDKs.

## 10. Test summary

Auth helper tests cover Bearer parsing, invalid verification, missing `uid`, valid verified user resolution, matching/missing body `userId`, and spoofed `userId` rejection.

Route tests cover missing auth, malformed auth, invalid token, matching authenticated request, missing body `userId`, spoofed body `userId`, invalid payload, and successful mock tutor response.

Verification commands:

- `npm run build` passed.
- `npm run lint` passed.
- `npx vitest run` passed.
- `npm run test:firebase:rules` was attempted. Earlier in the implementation it passed while local emulators were running; the final rerun failed with `ECONNREFUSED 127.0.0.1:8080` because the Firestore emulator was not running.
- `git diff --check` passed.

## 11. Reviewer findings summary

Security reviewer findings:

- No high-severity user ID spoofing issue found.
- The route rejects mismatched body `userId` with `403` and uses trusted auth identity before calling the tutor handler.
- No secrets, env files, Firebase cloud coupling, or Firestore/Storage/Gemini/Genkit scope creep found.
- Initial mutable verifier setter was replaced with explicit dependency injection.
- `AuthShell` avoids rendering raw auth provider errors.

Integration reviewer findings:

- App remains mock-only outside Auth.
- Route tests and existing handler tests are consistent after moving route auth expectations into focused auth tests.
- Default `npx vitest run` does not require emulators.
- No package changes were needed.

## 12. Disagreements or rejected options

- Firebase Admin was rejected for this PR to avoid cloud/admin credential setup.
- Real Firebase client SDK initialization was rejected because AuthShell is not wired to real config.
- AuthShell integration into the visible app was rejected to avoid a broader UI refactor.

## 13. What was intentionally not implemented

- Firebase Admin.
- Firebase Auth Emulator token verification.
- Firestore persistence.
- Storage upload.
- Gemini.
- Genkit.
- Retrieval.
- Learner memory persistence.
- Workspace persistence.
- Env files.
- Secrets.
- Real Firebase project IDs.
- Firebase cloud connection.

## 14. Whether Firestore persistence was added

No.

## 15. Whether Storage upload was added

No.

## 16. Whether Gemini/Genkit was added

No.

## 17. Whether retrieval/memory persistence was added

No.

## 18. Whether env files were added

No.

## 19. Whether secrets were added

No.

## 20. Whether real project IDs were added

No.

## 21. Whether Firebase cloud was connected

No.

## 22. Whether app remains mock-only outside Auth

Yes.

## 23. Whether repo is ready for Auth emulator integration or workspace persistence planning

Yes. The repo is ready for Auth Emulator integration tests or emulator token verification wiring. Workspace persistence should wait until the Auth verifier boundary is better covered.

## 24. Exact next recommended task

Add Auth Emulator integration tests or emulator token verification wiring, still without Firestore persistence, Storage upload, Gemini, Genkit, retrieval, or learner memory persistence.
