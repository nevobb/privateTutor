# Next Steps For Nevo

## Immediate next step

Add Auth Emulator integration tests or emulator token verification wiring for the Firebase Auth boundary. The route is protected by an injectable auth boundary, but real Firebase Admin/cloud verification is intentionally not connected.

## Practical sequence

1. Install Firebase CLI locally if it is not installed.
2. Install a local Java runtime if it is not installed.
3. Add explicit Auth Emulator tests for local token issuance and verification.
4. Decide whether the next verifier uses emulator-only Admin wiring or remains mocked.
5. Keep Firestore persistence, Storage upload, Gemini, Genkit, retrieval, and learner memory persistence for later PRs.
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

The repo has Phase A backend boundary scaffolding with mocks, Firebase emulator scaffolding, a passing local emulator smoke test, Firebase emulator rule tests for user isolation, Firebase Auth boundary planning, and a narrow Auth-protected tutor route. It is ready for Auth Emulator integration tests or emulator token verification wiring, not broad Firebase runtime connection or cloud setup.

## Suggested next subagent model

- One writer for server auth helpers and route protection.
- One writer for client auth shell boundary.
- One writer for auth tests.
- One reviewer for security and identity-spoofing risks.
- Main Codex remains the integrator and final committer.
