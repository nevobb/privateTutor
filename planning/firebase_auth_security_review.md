# Firebase Auth Security Review

## Secrets that must never be committed

Never commit:

- `.env`;
- `.env.local`;
- Firebase service account JSON;
- Firebase private keys;
- Firebase Admin credentials;
- Gemini or model provider API keys;
- OAuth client secrets;
- refresh tokens;
- deployment tokens;
- emulator export data containing private user content.

## Public Firebase client config vs server secrets

Firebase web client config is not the same as a server secret. Firebase API key, auth domain, and project ID are normally visible in browser code in Firebase web apps.

Even so, this planning PR must not add real config values. Real client config belongs in a later approved implementation task.

Server secrets are different. Firebase Admin credentials, service account private keys, Gemini keys, and deployment tokens must stay server-only and must live in deployment secret storage later.

## Emulator-only auth safety

Firebase Auth Emulator is local-only safety scaffolding.

Emulator users, demo project IDs, and emulator hosts must never be treated as production Auth. Local emulator configuration must not silently fall back to Firebase cloud.

The approved local project identifier remains `demo-private-tutor`.

## User ID trust boundary

The current tutor request validation accepts `userId` from the request body. That is acceptable only for the current mock/local scaffold.

For runtime Auth, the trusted user ID must come from a verified Firebase Auth identity.

The server must not trust a browser-submitted JSON `userId` as an ownership boundary.

## Server verification boundary

The later server boundary should:

- extract the bearer token from the request;
- verify the Firebase ID token server-side;
- derive trusted `uid`;
- reject unverifiable tokens with `401`;
- reject spoofed body identity with `403` or overwrite it before reaching the tutor handler.

Safe errors must not expose token contents, Firebase internals, stack traces, or credential details.

## Risk of trusting client-provided `userId`

If the server trusts client-provided `userId`, a user could submit another user's ID and potentially access, generate, retrieve, or persist data under the wrong account.

This risk matters before Firestore persistence exists because the same API boundary will later guard user-scoped workspaces, uploaded files, learner memory, academic knowledge, and decision logs.

## Future token verification needs

The future implementation must define separate emulator and cloud verification modes.

Emulator mode should accept emulator-issued ID tokens only in local development.

Cloud mode should verify real Firebase ID tokens using server-side credentials from deployment secret storage.

There must be no fallback from failed emulator verification to Firebase cloud.

## Avoiding broad runtime coupling

Auth should be integrated as a narrow boundary before other services.

The Auth boundary PR should not connect:

- Firestore persistence;
- Firebase Storage upload;
- Gemini;
- Genkit;
- retrieval;
- learner memory persistence;
- provider settings;
- cloud deployment.

## What not to expose in `NEXT_PUBLIC` values

Do not expose:

- service account JSON;
- private keys;
- Firebase Admin credentials;
- Gemini/API keys;
- OAuth client secrets;
- database admin URLs;
- signed URLs;
- refresh tokens;
- provider credentials;
- anything that grants backend authority.

Acceptable future `NEXT_PUBLIC_*` values are limited to Firebase client app config after Firebase setup is approved and the emulator/cloud boundary is explicit.
