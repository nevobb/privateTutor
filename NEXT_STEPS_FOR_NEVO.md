# Next Steps For Nevo

## Immediate next step

Plan Firebase runtime integration for the Authentication boundary only. Firestore and Storage user isolation now have local emulator rule tests, but the app runtime should still remain mock-only until a dedicated Auth-boundary integration plan is approved.

## Practical sequence

1. Install Firebase CLI locally if it is not installed.
2. Install a local Java runtime if it is not installed.
3. Review the Firebase emulator rule test results.
4. Plan the Auth boundary for runtime integration.
5. Keep Firestore, Storage, retrieval, memory persistence, and file upload for later dedicated PRs.
6. Do not connect broad Firebase runtime yet.

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

The repo has Phase A backend boundary scaffolding with mocks, Firebase emulator scaffolding, a passing local emulator smoke test, and Firebase emulator rule tests for user isolation. It is ready for Firebase runtime integration planning for the Auth boundary only, not broad Firebase runtime connection or cloud setup.
