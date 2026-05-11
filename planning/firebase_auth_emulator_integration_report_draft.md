# Firebase Auth Emulator Integration Report Draft

## What this covers

This draft documents the local Auth Emulator test path for the Firebase auth boundary work.

The goal is to validate auth behavior without any Firebase cloud dependency.

## Local run commands

Start the Auth Emulator only:

```bash
firebase emulators:start --only auth --project demo-private-tutor
```

Optional full local emulator session if the same test run also needs the other local services:

```bash
firebase emulators:start --only auth,firestore,storage --project demo-private-tutor
```

## What the emulator tests verify

These tests verify:

- local Auth Emulator startup and token flow;
- protected auth requests remain local-only;
- client-provided identity fields are not trusted over server-owned auth context;
- spoofed `userId` attempts are rejected with `403`;
- malformed or unverifiable auth fails with `401`;
- the verifier default remains fail-closed unless explicitly wired for emulator use in this PR.

## Safety and scope

The integration stays local-only.

It must not rely on:

- cloud Firebase;
- real Firebase project IDs;
- service account JSON;
- secrets;
- `.env` files;
- production Auth provider setup.

## Implementation note

The current verifier path remains fail-closed by default.

That is the right behavior for this PR unless the emulator verifier is explicitly wired into the route or helper boundary.

## Summary

Auth Emulator coverage here is meant to prove local auth correctness, not production sign-in.

It gives us a clean local signal that the auth boundary, token handling, and identity checks behave as expected before any cloud connection exists.
