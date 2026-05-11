# Firebase Auth Boundary Plan

## Purpose

Plan Firebase Authentication as an identity boundary only.

This plan does not connect Firebase Auth runtime, Firestore, Storage, Gemini, Genkit, retrieval, learner memory persistence, file upload, or cloud Firebase.

The current mock tutor provider remains the runtime default until a later implementation PR explicitly changes that boundary.

## Client-side auth boundary

The later implementation PR should add a small client-only auth boundary used from React/client code.

The client boundary should expose only stable app auth state:

- `status`: `loading`, `signed-out`, or `signed-in`.
- `userId`: Firebase `uid` when signed in.
- `displayName`: optional user display name.
- `email`: optional user email for account display only.
- `authProvider`: the provider used for sign-in.

Tutor components should not import Firebase Auth directly. They should receive authenticated identity through a narrow app-level boundary or shell.

Client code must not import Firebase Admin SDK, service account credentials, Gemini keys, provider secrets, retrieval code, or server-only modules.

## Server-side auth boundary

The later implementation PR should add a server-only auth boundary that verifies Firebase ID tokens.

The server boundary should:

- read `Authorization: Bearer <idToken>`;
- reject missing, malformed, expired, or unverifiable tokens with a safe `401`;
- derive trusted `userId` from the verified token `uid`;
- ignore or reject client-provided `userId` once auth protection is enabled;
- return a narrow result such as `{ ok: true, userId }` or `{ ok: false, status: 401 | 403, error }`.

Server auth code must stay outside UI components and must not expose service account or provider secrets to browser code.

## Emulator-first local flow

The first runtime implementation should use Firebase Auth Emulator before cloud Auth.

Local flow:

1. Start the Auth emulator with the existing `demo-private-tutor` emulator setup.
2. Client connects to Auth Emulator only in explicit local/emulator mode.
3. Local test user signs in through the emulator.
4. Client obtains a Firebase ID token.
5. Client sends the token to a protected server route through the `Authorization` header.
6. Server verifies the token in emulator-safe mode and derives `uid`.
7. Server passes trusted `userId` into the existing mock tutor boundary.

The first Auth boundary implementation should not require Firestore or Storage runtime access.

## Later cloud transition flow

Cloud transition should happen only after the emulator Auth boundary works locally.

Later cloud flow:

- replace placeholder/local client config with approved Firebase project config;
- configure real Firebase Auth provider settings only after Nevo approves them;
- keep server credentials in deployment secret storage;
- keep emulator config available for local development;
- rerun auth boundary tests before protecting cloud routes.

## Auth state and `userId` flow

Trusted user identity should flow from Firebase Auth, not from request JSON.

Future flow:

1. User signs in through Firebase Auth.
2. Client auth state exposes Firebase `uid` as app `userId`.
3. Client gets a fresh ID token before protected API calls.
4. `POST /api/tutor` receives the ID token in the `Authorization` header.
5. Server verifies the token and derives trusted `userId`.
6. Server keeps trusted `userId` in server-owned auth context and does not treat request JSON identity as authoritative.

The current request schema may keep `userId` for mock tests during the transition, but protected runtime behavior must not trust it. Preferred implementation is to reject mismatched body `userId` with `403` and move toward a protected request shape where identity is not part of user-controlled JSON.

## Future `POST /api/tutor` protection

The later implementation should protect `POST /api/tutor` with the server auth boundary.

Expected route behavior:

- missing auth header returns `401`;
- malformed auth header returns `401`;
- invalid token returns `401`;
- valid auth plus spoofed body `userId` returns `403`;
- valid auth plus invalid tutor payload returns `400`;
- valid auth plus valid tutor payload returns the existing structured mock tutor response.

Rejecting mismatched body `userId` with `403` is the chosen safer transition behavior so spoofing attempts are explicit.

## What remains mock-only

After the Auth boundary implementation:

- tutor responses still come from the mock provider;
- mock routing remains mock metadata;
- mock citations remain mock citations;
- memory updates remain candidates only and are not persisted;
- decision log events remain in response metadata and are not persisted;
- workspace, file, learner memory, and academic knowledge data may remain static mock data.

## Explicit exclusions

The Auth boundary implementation must not add:

- Firestore reads or writes;
- Storage upload, download, metadata writes, or indexing;
- Gemini API calls;
- Genkit flows;
- Gemini File Search;
- Google Search Grounding;
- retrieval provider calls;
- learner memory persistence;
- academic knowledge persistence;
- cloud deployment;
- production Auth provider setup;
- broad account settings or profile management.
