# Firebase Auth Test Strategy

## Purpose

Define tests for a future Firebase Auth boundary without connecting app runtime to Firebase cloud.

The Auth boundary tests must prove that server-owned identity wins over client-supplied `userId`.

## Current baseline

- Existing tutor tests protect mock behavior, routing, citations, Temporary Chat memory behavior, and no-web-search behavior.
- Existing Firebase rule tests are local-only under `tests/firebase`.
- Firebase rule tests run only when explicitly enabled.
- Current `POST /api/tutor` accepts `userId` from the request body, so future Auth work must treat that as temporary and unsafe.

## Auth boundary helper unit tests

Add pure helper tests under `tests/server/auth/`.

Future helper test targets:

- `extractBearerToken(request)`;
- `verifyFirebaseIdToken(token)`;
- `resolveAuthenticatedUser(request)`;
- `assertRequestUserMatchesAuthUser(bodyUserId, authUserId)`.

Unit tests should mock token verification and should not require Firebase emulators.

Cases to cover:

- missing `Authorization` header returns unauthenticated result;
- malformed `Authorization` header returns safe `401`;
- non-Bearer header returns safe `401`;
- empty Bearer token returns safe `401`;
- valid verified token returns `{ uid }`;
- verified token without `uid` returns safe `401`;
- `body.userId === auth.uid` is allowed;
- `body.userId !== auth.uid` is rejected;
- protected route identity should come from server-owned auth context, not injected user-controlled JSON.

## Tests proving client `userId` is not trusted blindly

Add explicit security tests:

- `rejects a tutor request when body.userId differs from authenticated uid`;
- `keeps authenticated uid in server-owned context`;
- `does not pass spoofed body.userId into the tutor handler`.

Route-level test shape:

- send a token for `alice`;
- send body `{ userId: "bob" }`;
- expect `403 Forbidden` for identity mismatch;
- expect no tutor response;
- expect no mock provider call.

Preferred behavior is `403` for authenticated identity spoofing.

## Emulator Auth tests if practical

Optional Auth Emulator tests may be added under `tests/firebase/auth.emulator.test.ts`.

They should run only with an explicit flag such as `FIREBASE_AUTH_EMULATOR_TEST=1`.

Cases to cover:

- create or sign in a local emulator user;
- obtain an ID token;
- verify the server boundary accepts emulator token only in emulator mode;
- clean up local emulator user after the test.

These tests should stay separate from Firestore and Storage rule tests.

## Later API route auth tests

After the auth route boundary exists, add tests for:

- no auth header returns `401`;
- invalid token returns `401`;
- valid token plus matching user returns `200`;
- valid token plus spoofed body user returns `403`;
- invalid JSON still returns `400`;
- valid auth with invalid tutor payload still returns `400`.

Safe error bodies should use simple messages such as `{ error: "Unauthorized." }` and must not leak token details.

## Regression tests preserving mock tutor behavior

Auth should gate access, not change tutor pedagogy.

Existing tests should continue to verify:

- mock provider is still used;
- no external model is called;
- no web search is reported;
- Temporary Chat writes no memory;
- hint-only behavior does not reveal full solution;
- Research mode still returns mock citations.

## No-cloud testing rule

All tests must use either mocked verification or Firebase emulators with `demo-private-tutor`.

Tests must not require:

- `firebase login`;
- real Firebase project IDs;
- service account JSON;
- `.env` or `.env.local`;
- Firebase cloud APIs.

## Behavior when emulators are not running

Default `npx vitest run` must not fail because emulators are down.

Emulator-dependent tests should be skipped unless explicitly enabled.

If explicitly enabled and emulators are down, fail with a clear local-tooling message and do not fall back to cloud verification.

## Default-skipped vs explicit tests

Default run:

- pure auth helper unit tests;
- mocked route auth tests;
- existing behavior regression tests.

Explicit local emulator run:

- Auth emulator tests;
- Firestore/Storage rule tests.

Suggested future scripts:

- `test:firebase:auth`;
- `test:firebase:auth:emulators`.

## Recommended implementation order

1. Add pure auth boundary helpers and mocked unit tests.
2. Update the tutor route to derive `userId` from verified auth, not request body.
3. Add mocked route auth tests proving spoofed `userId` is rejected.
4. Add optional Auth Emulator tests if the Firebase SDK/Admin boundary exists.
5. Keep Firestore, Storage, memory, retrieval, Gemini, Genkit, and cloud integration out.
