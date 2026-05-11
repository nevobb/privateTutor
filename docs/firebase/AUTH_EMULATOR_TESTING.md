# Firebase Auth Emulator Testing

## Purpose

Use the Firebase Auth Emulator to prove the auth boundary locally without touching Firebase cloud.

These tests are local-only, deterministic, and safe to run in a developer environment.

## How to run

Start only the Auth Emulator:

```bash
firebase emulators:start --only auth --project demo-private-tutor
```

If you already need the full local Firebase stack for the same session, you can start the broader emulator set instead:

```bash
firebase emulators:start --only auth,firestore,storage --project demo-private-tutor
```

The project ID above is a local demo placeholder only.

## What these tests verify

Auth Emulator tests should verify the local identity boundary, not cloud behavior.

They should prove that:

- the app can run against the Auth Emulator with no cloud connection;
- emulator-issued sign-in and ID-token flows work locally;
- protected requests still derive identity from server-side auth context;
- spoofed client `userId` data is rejected or ignored;
- safe `401` and `403` responses are returned for invalid or mismatched auth;
- the default verifier remains fail-closed unless a test or implementation explicitly wires emulator verification.

## What they must not use

Auth Emulator tests must not require:

- Firebase cloud;
- real project IDs;
- secrets;
- service account files;
- `.env` or `.env.local`;
- production Firebase credentials.

## Expected failure mode

Until the emulator verifier is explicitly wired into runtime code, the default verifier should stay fail-closed.

That means unauthenticated or unverifiable requests should still return `401` instead of silently succeeding.

## Notes

- Keep these tests separate from Firestore and Storage rule tests.
- Keep the local demo project ID `demo-private-tutor` in emulator commands and test fixtures.
- Do not add any production Firebase configuration to support these tests.
