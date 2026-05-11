# Next Steps For Nevo

## Immediate next step

Install Firebase CLI and Java locally, then rerun the Firebase emulator smoke test. The first smoke-test documentation pass confirmed that the current local environment is missing both tools, so the emulators were not started.

## Practical sequence

1. Install Firebase CLI locally if it is not installed.
2. Install a local Java runtime if it is not installed.
3. Rerun the Firebase emulator smoke test with `demo-private-tutor`.
4. Verify Emulator UI opens.
5. Verify Auth, Firestore, and Storage emulators start with local rules.
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

The repo has Phase A backend boundary scaffolding with mocks and Firebase emulator scaffolding. The scaffold is ready for local emulator smoke testing after Firebase CLI and Java are installed; it is not ready for direct Firebase runtime connection or cloud setup.
