# Firebase Emulator Scaffolding

## 1. What files were added

- `firebase.json`
- `.firebaserc`
- `firestore.rules`
- `storage.rules`
- `docs/firebase/EMULATOR_SCAFFOLDING.md`
- `planning/firebase_emulator_scaffolding_report.md`

## 2. How to run emulators later

After Firebase CLI is installed in the local environment, run:

```bash
firebase emulators:start
```

To start only the planned local services:

```bash
firebase emulators:start --only auth,firestore,storage
```

The local smoke test used:

```bash
firebase emulators:start --only auth,firestore,storage --project demo-private-tutor
```

Smoke test result: Auth, Firestore, Storage, Emulator UI, and Emulator Hub started successfully.

Do not run `firebase login`, `firebase init`, or `firebase deploy` as part of this scaffolding task.

## 3. Required tools later

- Firebase CLI.
- Local Java runtime if required by Firebase emulators.
- Browser access to the Emulator UI at `http://localhost:4000`.

No Firebase SDK packages are installed by this scaffolding task.

## Smoke test result

- Firebase CLI: `15.17.0`.
- Java: Temurin OpenJDK `26.0.1`.
- Emulator UI: `http://127.0.0.1:4000/`.
- Authentication: `127.0.0.1:9099`.
- Firestore: `127.0.0.1:8080`.
- Storage: `127.0.0.1:9199`.
- Emulator Hub: `127.0.0.1:4400`.
- Firestore and Storage rules loaded sufficiently for emulator startup.
- Observed Node and Java runtime warnings did not block startup.
- Firebase cloud was not connected.

## 4. Local-only project ID explanation

`.firebaserc` uses only `demo-private-tutor`.

This is a demo/local placeholder project ID for emulator use. It is not a real Firebase project ID and must not be replaced with a real project ID until a later approved setup task.

## 5. What is not connected

- App runtime is not connected to Firebase.
- `POST /api/tutor` still uses the mock provider.
- Firebase Authentication is not connected.
- Firestore is not connected.
- Firebase Storage is not connected.
- No Firebase SDK or Admin SDK is imported.
- No cloud Firebase project is connected.

## 6. Safety rules

- Do not commit real Firebase project IDs.
- Do not commit API keys.
- Do not commit service account JSON.
- Do not add `.env` or `.env.local`.
- Do not seed private user data into emulator exports.
- Do not treat first-pass rules as production-ready.

## 7. How this relates to `POST /api/tutor`

The tutor API route remains mock-only. Emulator scaffolding is only local infrastructure preparation. The route should not import Firebase until a later runtime integration task explicitly requests it.

## 8. Go/no-go before runtime Firebase connection

Go only when:

- emulator startup has been smoke tested locally
- Emulator UI opens
- Auth emulator is reachable
- Firestore emulator loads rules
- Storage emulator loads rules
- no real project IDs or secrets are committed
- `POST /api/tutor` remains stable with mock provider tests

No-go if:

- runtime code would import Firebase before a dedicated integration task
- rules are untested
- `.env` files are required
- app code would connect to cloud Firebase
