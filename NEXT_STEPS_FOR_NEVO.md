# Next Steps For Nevo

## Immediate next step

Plan the Firebase/Genkit/Gemini mock-to-real backend transition from `/docs`, starting with server-side architecture and provider abstractions before any real external-service connection.

## Practical sequence

1. Define the server-side tutor response boundary from `docs/04_Firebase_Genkit_Backend_Architecture.md` and `docs/05_Gemini_API_Integration_Spec.md`.
2. Add deterministic intent detection for hint, full solution, local conceptual question, broad query, and simple fact.
3. Add retrieval routing as a pure local function before connecting any retrieval provider.
4. Add Decision Log storage shape and hidden technical reporting before connecting Firebase.
5. Add Firebase/Genkit/Gemini only in a dedicated integration task with server-side secrets handling.

## Do not do yet

- Do not connect Firebase, Firestore, Firebase Storage, Gemini, Genkit, Gemini File Search, Google Search Grounding, or real retrieval.
- Do not add API keys, secrets, environment variables, or frontend provider credentials.
- Do not redesign the app or turn it into an LMS/dashboard.
- Do not implement persistent learner memory until the memory write policy and storage boundary are planned.

## Readiness note

The repo is docs-aligned enough for the next planning step. It is not yet ready for direct Firebase setup without a dedicated backend transition plan.
