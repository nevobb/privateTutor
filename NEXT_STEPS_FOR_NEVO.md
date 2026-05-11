# Next Steps For Nevo

## Immediate next step

Run local Firebase emulator smoke testing after Firebase CLI is installed. This should verify Emulator UI, Auth, Firestore rules, and Storage rules without connecting app runtime to Firebase cloud.

## Practical sequence

1. Install Firebase CLI locally if it is not installed.
2. Run emulators locally with the demo project.
3. Verify Emulator UI opens.
4. Verify Auth, Firestore, and Storage emulators start with local rules.
5. Do not connect app runtime yet.

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

The repo has Phase A backend boundary scaffolding with mocks and Firebase emulator scaffolding. It is ready for local emulator smoke testing, not direct Firebase runtime connection or cloud setup.
