# Firebase Emulator Rule Tests Report

## 1. Branch used

`test/firebase-emulator-rules`

## 2. Files added

- `tests/firebase/rulesTestUtils.ts`
- `tests/firebase/firestore.rules.test.ts`
- `tests/firebase/storage.rules.test.ts`
- `planning/firebase_emulator_rule_tests_report.md`

## 3. Files changed

- `package.json`
- `package-lock.json`
- `PROJECT_STATE.md`
- `NEXT_STEPS_FOR_NEVO.md`

## 4. Dependencies added, if any

- `@firebase/rules-unit-testing` as a dev dependency.
- `firebase` as a dev dependency because it is the required peer dependency for `@firebase/rules-unit-testing`.

These dependencies are test-only and do not connect the app runtime to Firebase.

## 5. Package scripts added, if any

- `test:firebase:rules`
- `test:firebase:rules:emulators`

`test:firebase:rules` runs the rules tests against already-running local emulators.

`test:firebase:rules:emulators` starts local emulators through `firebase emulators:exec` using the demo project ID `demo-private-tutor`.

## 6. Firestore tests implemented

- Authenticated users can read/write their own user document.
- Authenticated users can read/write their own workspace document.
- Authenticated users can read/write their own uploaded file metadata.
- Authenticated users can read/write their own learner memory document.
- Authenticated users can read/write their own academic knowledge document.
- Authenticated users can read/write their own decision log document.
- Authenticated users cannot read/write another user's user document.
- Authenticated users cannot read/write another user's workspace document.
- Unauthenticated users cannot read/write user documents.
- Authenticated users cannot read/write outside `/users/{userId}`.

## 7. Storage tests implemented

- Authenticated users can write/read their own PDF-like file path.
- Authenticated users can write/read their own DOCX-like file path.
- Authenticated users cannot write/read another user's file.
- Unauthenticated users cannot write/read a user's file.
- Authenticated users cannot write/read outside `users/{userId}/...`.

## 8. Commands run and pass/fail

- `npm install --save-dev @firebase/rules-unit-testing@^5.0.1 firebase@^12.13.0` - passed.
- `npx vitest run` - passed; normal tests passed and Firebase rules tests were skipped without `FIREBASE_RULES_TEST=1`.
- `npm run lint` - passed.
- `npm run test:firebase:rules` with the first emulators-starting script version - failed because the local emulator ports were already occupied by running emulators.
- `lsof -nP -iTCP:9099 -iTCP:8080 -iTCP:9199 -iTCP:4400 -sTCP:LISTEN` - passed; confirmed local emulator processes were already listening.
- `FIREBASE_RULES_TEST=1 npx vitest run tests/firebase` - passed; 17 Firebase rules tests passed.
- `npm run build` - passed.
- `npm run lint` - passed.
- `npx vitest run` - passed; 25 normal tests passed and 17 Firebase rules tests were skipped.
- `npm run test:firebase:rules` - passed; 17 Firebase rules tests passed against the running local emulators.
- `git diff --check` - passed.

## 9. Whether Firebase emulators were required

Yes. The Firebase rule tests require local Auth, Firestore, and Storage emulators.

During verification, emulators were already running locally, so `npm run test:firebase:rules` was used against the running emulators. The `test:firebase:rules:emulators` script is available for clean environments where the ports are not already occupied.

## 10. Whether Firebase cloud was contacted

No. Tests use local emulators and the demo project ID `demo-private-tutor`.

## 11. Whether app runtime code changed

No.

## 12. Whether Firebase SDK/Admin imports were added to app runtime

No.

## 13. Whether env files were added

No.

## 14. Whether secrets were added

No.

## 15. Whether real project IDs were added

No.

## 16. Whether app remains mock-only

Yes.

## 17. Whether rules are production-ready

No. These remain first-pass emulator rules and are not production-ready.

## 18. Whether repo is ready for Firebase runtime integration planning

Yes, for Firebase Authentication boundary planning only. Broad runtime integration, Firestore persistence, Storage upload, retrieval, and memory persistence should remain separate later tasks.

## 19. Exact next recommended task

Plan Firebase runtime integration for the Authentication boundary only, still without broad Firebase runtime integration.
