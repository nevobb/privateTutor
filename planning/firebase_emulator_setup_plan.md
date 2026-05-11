# Firebase Emulator Setup Plan

This is a preparation document. It does not add Firebase runtime code, Firebase config files, Firebase packages, CLI packages, environment files, secrets, or cloud connections.

## 1. Why emulator-first was chosen

Nevo chose Firebase Emulator first before any Firebase cloud/runtime connection.

Emulator-first protects the project by:

- validating the data model locally before cloud writes exist
- testing security rules before real user data exists
- keeping the mock provider as the runtime default
- avoiding premature cloud coupling
- reducing risk from accidental secrets or project IDs in source control

## 2. Emulator components planned

Planned local emulators:

- Authentication emulator
- Firestore emulator
- Storage emulator

Not planned in this preparation task:

- real Firebase Authentication
- real Firestore
- real Firebase Storage
- real app runtime connection
- deployed rules
- package installation

## 3. Local development flow

Future emulator development should follow this order:

1. Install Firebase tooling in a dedicated implementation task.
2. Add Firebase emulator config files with placeholder project IDs only.
3. Start emulators locally.
4. Run rule tests and data-model tests against local emulators.
5. Keep `POST /api/tutor` on the mock provider until Firebase integration is explicitly requested.
6. Only after local rules and data model pass should cloud Firebase setup be considered.

## 4. What commands will eventually be used

Future commands may include:

```bash
firebase login
firebase init emulators
firebase emulators:start
firebase emulators:exec "npm test"
```

These commands are not run by this preparation task.

## 5. What must be installed later

Later implementation may require:

- Firebase CLI
- Firebase app SDK
- Firebase Admin SDK
- local emulator test tooling

No Firebase packages or CLI packages are installed in this task.

## 6. What files may be added later

Later implementation may add:

- `firebase.json`
- `.firebaserc`
- Firestore rules file
- Storage rules file
- emulator seed scripts
- local emulator test files
- `.env.local` for local-only values

None of those files are added in this task.

## 7. What must not be committed

Never commit:

- API keys
- service account keys
- real `.env` files
- real `.env.local`
- real private keys
- real Firebase project secrets
- downloaded Google credentials
- generated emulator data containing private user content

## 8. Go/no-go checklist before runtime connection

Go only when:

- Firebase project name is chosen.
- Auth provider decision is made.
- Emulator-first duration is clear.
- Firestore rules are drafted and tested locally.
- Storage rules are drafted and tested locally.
- Placeholder env names are documented.
- No real secrets are present in Git.
- Mock provider remains the default until runtime integration is explicitly requested.

No-go if:

- app runtime would import Firebase before emulator scaffolding is reviewed
- any real project ID or API key would be committed
- Firestore/Storage rules are not tested locally
- Learner Memory and Academic Knowledge boundaries are unclear
- cloud setup is being used to skip local validation
