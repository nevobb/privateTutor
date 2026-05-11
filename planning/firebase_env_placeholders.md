# Firebase Environment Placeholder Names

This document lists placeholder names only. It contains no values, no secrets, no real project IDs, and no runtime configuration.

## Placeholder names

- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_AUTH_EMULATOR_HOST`
- `FIRESTORE_EMULATOR_HOST`
- `FIREBASE_STORAGE_EMULATOR_HOST`
- `NEXT_PUBLIC_FIREBASE_API_KEY_PLACEHOLDER_ONLY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_PLACEHOLDER_ONLY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID_PLACEHOLDER_ONLY`
- `GEMINI_API_KEY`
- `GOOGLE_CLOUD_PROJECT`

## Important distinction

`NEXT_PUBLIC_*` Firebase client config values are not the same as server secrets. They are normally visible to browser code in Firebase web apps.

Even so, this planning PR must not fill them with real values. Real client config belongs in a later implementation task after Nevo approves Firebase setup and the emulator/cloud boundary is clear.

## Server secrets

Server-only values such as service account private keys and Gemini keys must never be exposed to frontend code and must never be committed.

## Files not added in this task

- `.env`
- `.env.local`
- `.firebaserc`
- `firebase.json`
- service account JSON files
- real Firebase config modules
