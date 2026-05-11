# Firebase Auth Boundary Implementation

This document describes the narrow Firebase Auth boundary implementation.

## What the boundary does

- Requires `Authorization: Bearer <token>` for `POST /api/tutor`.
- Extracts and validates the Bearer header.
- Resolves an authenticated user through an injectable token verifier.
- Derives trusted `userId` from the verified token `uid`.
- Rejects spoofed body `userId` with `403`.
- Supplies trusted `userId` to the existing mock tutor handler because the current tutor request schema still requires it.

## Token verification status

Firebase Admin and cloud token verification are not configured in this PR.

The verifier is injectable so tests can prove route behavior without real Firebase credentials, Firebase cloud, service accounts, or env files.

The default verifier fails closed with `401` until a later Auth Emulator or Admin verification task wires real verification.

## `401` and `403` behavior

- Missing `Authorization` header: `401`.
- Malformed `Authorization` header: `401`.
- Invalid or unverifiable token: `401`.
- Verified token with missing `uid`: `401`.
- Valid auth with body `userId` for another user: `403`.
- Valid auth with invalid tutor payload: `400`.

Safe errors do not expose token contents, stack traces, Firebase internals, or credential details.

## Spoofed `userId` protection

The request body is not trusted as an identity boundary.

If a request authenticates as `alice` but sends body `userId: "bob"`, the route returns `403` and does not call the tutor handler.

If body `userId` is missing, the route supplies the trusted authenticated `uid` to the current mock tutor handler.

## Client AuthShell boundary

`AuthShell` is a standalone Hebrew RTL boundary component. It provides loading, signed-out, signed-in, and auth-error branches.

It is not wired into the visible app in this PR, so the main tutor UI remains unchanged.

The component does not import Firebase runtime SDKs and does not require real Firebase config.

## What remains mock-only

- Tutor responses still use the mock provider.
- Workspace, files, learner memory, academic knowledge, and decision log data remain mock/static.
- Temporary Chat remains non-persistent.
- No model, retrieval, web search, or provider runtime is connected.

## What is not connected

- Firestore persistence.
- Firebase Storage upload.
- Firebase Admin.
- Firebase cloud.
- Gemini.
- Genkit.
- Retrieval.
- Learner memory persistence.
- Workspace persistence.
- Production Google Sign-In provider setup.

## Testing commands

```bash
npm run build
npm run lint
npx vitest run
```

If local emulators are already running:

```bash
npm run test:firebase:rules
```

Do not run `firebase login`, `firebase init`, or `firebase deploy` for this boundary.
