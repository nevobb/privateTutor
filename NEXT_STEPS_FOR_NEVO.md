# Next Steps For Nevo

## Immediate next step

Add Firebase emulator scaffolding in a dedicated PR. Nevo has chosen Firebase Emulator first, so the next step is local emulator config and rule-test scaffolding, not cloud runtime connection.

## Practical sequence

1. Add Firebase emulator scaffolding files only when the implementation task explicitly requests them.
2. Keep app runtime on the mock provider while emulator scaffolding is reviewed.
3. Add draft rule tests before real cloud data exists.
4. Keep placeholder environment variable names value-free until a later approved setup task.
5. Do not connect Firebase cloud services from runtime code yet.

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

The repo has Phase A backend boundary scaffolding with mocks and Firebase emulator-first preparation docs. It is ready for emulator scaffolding, not direct Firebase runtime connection.
