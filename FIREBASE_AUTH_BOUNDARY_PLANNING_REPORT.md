# Firebase Auth Boundary Planning Report

## 1. Branch used

`planning/firebase-auth-runtime-boundary`

## 2. Subagents used

- Writer Subagent A: Auth architecture plan.
- Writer Subagent B: Security and secrets review.
- Writer Subagent C: Test strategy.
- Writer Subagent D: UI/session contract.
- Reviewer Subagent E: Security reviewer.
- Reviewer Subagent F: Integration reviewer.

## 3. Subagent file ownership map

- Writer A: `planning/firebase_auth_boundary_plan.md`
- Writer B: `planning/firebase_auth_security_review.md`
- Writer C: `planning/firebase_auth_test_strategy.md`
- Writer D: `planning/firebase_auth_ui_contract.md`
- Main Codex: `FIREBASE_AUTH_BOUNDARY_PLANNING_REPORT.md`, `PROJECT_STATE.md`, `NEXT_STEPS_FOR_NEVO.md`, and `DECISION_LOG.md`

## 4. Files added

- `planning/firebase_auth_boundary_plan.md`
- `planning/firebase_auth_security_review.md`
- `planning/firebase_auth_test_strategy.md`
- `planning/firebase_auth_ui_contract.md`
- `FIREBASE_AUTH_BOUNDARY_PLANNING_REPORT.md`

## 5. Files changed

- `PROJECT_STATE.md`
- `NEXT_STEPS_FOR_NEVO.md`
- `DECISION_LOG.md`

## 6. Auth boundary plan summary

Firebase Auth should be implemented as a narrow identity boundary before any broader Firebase runtime integration.

The future client boundary should expose minimal auth state and pass stable identity into the tutor UI. The future server boundary should verify Firebase ID tokens and derive trusted `uid` from the token.

`POST /api/tutor` must not trust body `userId` once auth protection exists.

## 7. Security findings summary

The main risk is trusting client-provided `userId`.

Future server code must reject or overwrite spoofed body identity using a verified Firebase Auth token.

Public Firebase client config is not the same as server secrets, but real values still do not belong in this planning PR.

Server secrets, service account keys, Gemini keys, and provider credentials must never be exposed in client code or committed files.

## 8. Test strategy summary

The next implementation should add pure auth helper tests and mocked route tests before relying on emulator Auth tests.

Default tests must not depend on running emulators.

Optional Auth Emulator tests should run explicitly and must never fall back to Firebase cloud.

Existing mock tutor behavior tests should continue to pass unchanged.

## 9. UI/session contract summary

The future UI should add a minimal Hebrew RTL `AuthShell` above the tutor workspace.

Recommended MVP provider is Google Sign-In only.

Temporary Chat can exist before login only as an ephemeral mode with no Firestore writes, Storage uploads, memory writes, workspace creation, or automatic migration.

## 10. Reviewer findings summary

Security review findings:

- no secrets or env files should be added;
- server `uid` must come from verified Firebase Auth identity;
- client `userId` must not be trusted;
- Auth must not pull Firestore, Storage, Gemini, Genkit, retrieval, or memory persistence into the same PR.
- workspace/profile bootstrap belongs to a later Firestore/workspace task, not the Auth boundary PR.
- spoofed body `userId` should be rejected with `403`, not silently trusted or treated as the identity source.

Integration review findings:

- the next implementation can be limited to Auth boundary helpers, an auth shell, and route protection;
- likely future files are auth helper modules, client auth boundary modules, and focused auth tests;
- `POST /api/tutor` currently accepts `userId` from the body and must be adapted carefully later;
- existing unauthenticated route tests will need to be split or updated when the route is protected;
- the current UI calls the mock tutor directly, so protecting `POST /api/tutor` will not affect the visible tutor until a later UI-to-route task;
- package changes are likely needed later for Firebase Auth/Admin, but not in this planning PR.

## 11. Disagreements or rejected options

Rejected options:

- broad Firebase runtime integration in the Auth PR;
- trusting client-provided `userId`;
- overwriting spoofed body `userId` silently instead of rejecting it;
- profile/workspace bootstrap inside the Auth boundary PR;
- email/password for MVP by default;
- running Auth Emulator tests in default `npx vitest run`;
- auto-migrating signed-out Temporary Chat into permanent user history.

## 12. What was intentionally not implemented

- Firebase Auth runtime.
- Firebase app initialization.
- Firebase Admin initialization.
- Login UI.
- Auth middleware.
- Firestore persistence.
- Storage upload.
- Gemini.
- Genkit.
- Retrieval.
- Learner memory persistence.
- Real Firebase project IDs.
- Env files.
- Secrets.

## 13. Whether app runtime code changed

No.

## 14. Whether packages were installed

No.

## 15. Whether env files were added

No.

## 16. Whether secrets were added

No.

## 17. Whether real Firebase project IDs were added

No.

## 18. Whether Firebase cloud was connected

No.

## 19. Whether app remains mock-only

Yes.

## 20. Whether repo is ready for Auth boundary implementation

Yes. The repo is ready for a narrow Firebase Auth boundary implementation PR only.

## 21. Exact next recommended task

Implement Firebase Auth boundary helpers, minimal client auth shell planning hooks, and route-level auth protection for `POST /api/tutor`, still without Firestore persistence, Storage upload, Gemini, Genkit, retrieval, or learner memory persistence.
