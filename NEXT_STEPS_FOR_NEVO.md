# Next Steps For Nevo

## Immediate next step

Implement Phase A: backend boundary scaffolding with the mock provider only. This means request/response schemas, validation shapes, and tests before any Firebase, Genkit, Gemini, retrieval, upload, or persistence connection.

## Practical sequence

1. Add a server-side tutor response boundary that still calls the existing mock tutor behavior.
2. Add request and response validation shapes for work mode, cost mode, workspace scope, visible response, citations, memory candidates, and decision log events.
3. Add tests for valid requests, invalid requests, guidance-only behavior, local question stop behavior, Cheap Practice behavior, Research citations, and Temporary Chat no-memory behavior.
4. Keep the mock provider as the default until schemas and tests are stable.
5. Plan Firebase/Genkit/Gemini setup only after the backend boundary is proven with mocks.

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

The repo has a backend transition plan. It is ready for backend boundary scaffolding with mocks, not direct Firebase setup.
