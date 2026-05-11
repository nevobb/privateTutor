# Next Steps For Nevo

## Immediate next step

Prepare Firebase project setup documentation and decide whether to use Firebase Emulator first. Do not connect the app runtime to Firebase yet.

## Practical sequence

1. Choose whether Firebase Emulator is required before any cloud project connection.
2. Document Firebase console setup steps for Authentication, Firestore, and Storage.
3. Document local placeholder environment variable names without values.
4. Draft Firestore and Storage security-rule requirements.
5. Keep the mock provider as the runtime default until Firebase setup is explicitly requested.

## Decisions Nevo must make before real setup

1. Firebase project name.
2. Whether to use Firebase Emulator first.
3. Deployment target later.
4. Whether authentication starts with Google login only.
5. Whether file upload is delayed until after the tutor API route.

## Do not do yet

- Do not connect Firebase, Firestore, Firebase Storage, Gemini, Genkit, Gemini File Search, Google Search Grounding, or real retrieval.
- Do not add API keys, secrets, environment variables, or frontend provider credentials.
- Do not redesign the app or turn it into an LMS/dashboard.
- Do not implement persistent learner memory until the memory write policy and storage boundary are planned.

## Readiness note

The repo has Phase A backend boundary scaffolding with mocks. It is ready for Firebase setup preparation and emulator decision planning, not direct Firebase runtime connection.
