# Next Steps For Nevo

## Immediate next step

Implement Firebase emulator rule tests for Firestore and Storage user isolation. The local emulator smoke test passed with Auth, Firestore, Storage, Emulator UI, and Emulator Hub running under `demo-private-tutor`.

## Practical sequence

1. Install Firebase CLI locally if it is not installed.
2. Install a local Java runtime if it is not installed.
3. Add local emulator rule tests for Firestore user isolation.
4. Add local emulator rule tests for Storage user isolation.
5. Keep the tests on the demo project and local emulators only.
6. Do not connect app runtime yet.

## Decisions Nevo must make before real setup

1. Firebase project name.
2. Auth provider for MVP: Google only or email/password too.
3. Storage size limit for MVP.
4. Deployment target later.

## Do not do yet

- Do not connect Firebase, Firestore, Firebase Storage, Gemini, Genkit, Gemini File Search, Google Search Grounding, or real retrieval.
- Do not add API keys, secrets, environment variables, or frontend provider credentials.
- Do not redesign the app or turn it into an LMS/dashboard.
- Do not implement persistent learner memory until the memory write policy and storage boundary are planned.

## Readiness note

The repo has Phase A backend boundary scaffolding with mocks and Firebase emulator scaffolding. The local emulator smoke test has passed, so the repo is ready for Firebase emulator rule tests; it is not ready for direct Firebase runtime connection or cloud setup.
