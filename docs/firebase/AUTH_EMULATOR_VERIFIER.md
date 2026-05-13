# Firebase Auth Emulator Token Verifier

## Purpose

Provides a local-only Firebase token verifier for the `demo-private-tutor` project
that works against the Firebase Auth emulator without Firebase Admin SDK.

Used to unblock workspace API calls from the browser UI in local development:
browser sign-in → emulator issues ID token → server verifies token → API responds.

## Endpoint Used

```
POST http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-key
Content-Type: application/json
Body: { "idToken": "<token>" }
```

- Host is always `127.0.0.1:9099` — never a cloud endpoint.
- `demo-key` is the standard Firebase demo project placeholder — not a real secret.
- Project ID is always `demo-private-tutor`.

## Successful Response Shape

```json
{
  "users": [
    {
      "localId": "<uid>",
      "email": "user@example.com"
    }
  ]
}
```

`localId` becomes the trusted `uid`. This is the same field as Firebase Auth's `uid`/`userId`.

## Failure Behavior

The verifier returns `null` in all error cases:

| Condition | Behavior |
|-----------|---------|
| Network error (emulator not running) | returns null |
| Non-200 HTTP response | returns null |
| Malformed JSON response body | returns null |
| Empty `users` array | returns null |
| Missing `users` key | returns null |
| `localId` missing or empty | returns null |
| `localId` not a string | returns null |

A `null` result causes `resolveAuthenticatedUser` to return 401 Unauthorized.
The verifier never throws — it always fails closed.

## Implementation

**`src/server/auth/authEmulatorConfig.ts`**
Hardcoded emulator connection constants (mirrors `firebaseServerConfig.ts` pattern).

**`src/server/auth/verifyFirebaseTokenEmulator.ts`**
Calls the Auth emulator REST lookup endpoint. Injectable `fetchFn` parameter for testability.

**`src/server/auth/verifyFirebaseToken.ts`**
Updated to delegate to `verifyFirebaseTokenEmulator` as the default verifier.

## Not Production-Ready

- Does not verify token signatures.
- Does not call any cloud Firebase Auth endpoint.
- Only valid for `demo-private-tutor` emulator mode.
- Not suitable for production use.

## Running Tests

**Unit tests (no emulator required):**
```
npx vitest run tests/server/auth/verifyFirebaseTokenEmulator.test.ts
```

**Emulator integration tests (Auth emulator must be running):**
```
npm run test:firebase:auth:emulators
```
or manually:
```
FIREBASE_AUTH_EMULATOR_TEST=1 vitest run tests/firebase/authEmulatorVerifier.emulator.test.ts
```
