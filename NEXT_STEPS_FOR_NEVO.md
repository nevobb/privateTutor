# Next Steps For Nevo

## Immediate next step

Implement the Firebase Auth runtime boundary only. Firestore and Storage user isolation have local emulator rule tests, and Auth boundary planning is now defined, but the app runtime should remain mock-only outside the narrow Auth boundary.

## Practical sequence

1. Install Firebase CLI locally if it is not installed.
2. Install a local Java runtime if it is not installed.
3. Implement narrow auth helper modules and tests.
4. Add minimal AuthShell boundary work only if scoped to authentication state.
5. Protect `POST /api/tutor` by deriving trusted `userId` from verified auth.
6. Do not implement Firestore persistence, Storage upload, Gemini, Genkit, retrieval, or learner memory persistence.

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

The repo has Phase A backend boundary scaffolding with mocks, Firebase emulator scaffolding, a passing local emulator smoke test, Firebase emulator rule tests for user isolation, and Firebase Auth boundary planning. It is ready for narrow Firebase Auth boundary implementation only, not broad Firebase runtime connection or cloud setup.

## Suggested next subagent model

- One writer for server auth helpers and route protection.
- One writer for client auth shell boundary.
- One writer for auth tests.
- One reviewer for security and identity-spoofing risks.
- Main Codex remains the integrator and final committer.
