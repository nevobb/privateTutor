# Firebase Production Setup

## Purpose
This guide explains how to run `privateTutor` in explicit production Firebase mode for personal use, while keeping emulator mode available.

## Modes
- Emulator mode:
  - `NEXT_PUBLIC_FIREBASE_MODE=emulator`
  - `FIREBASE_MODE=emulator`
- Production mode:
  - `NEXT_PUBLIC_FIREBASE_MODE=production`
  - `FIREBASE_MODE=production`

Do not mix modes.

## Required Firebase setup
1. Create/select a Firebase project.
2. Enable Authentication and Google sign-in provider.
3. Add authorized domains (`localhost` for local testing, production domain later).
4. Create Firestore database.
5. Create Firebase Storage bucket.
6. Register a Web app and copy public config values.

## Local env values
Use `.env.local` (never commit):

- Client/public config:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_APP_ID` (optional)
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (optional)
- Server config:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_STORAGE_BUCKET`
  - `GOOGLE_APPLICATION_CREDENTIALS` (preferred), or
  - `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`

## Credentials and security
- Keep Admin credentials server-side only.
- Do not use `NEXT_PUBLIC_` for secrets.
- Do not commit service account files.
- Do not commit `.env.local`.

## Switching back to emulator mode
Set:
- `NEXT_PUBLIC_FIREBASE_MODE=emulator`
- `FIREBASE_MODE=emulator`

Then restart the app and emulators.
