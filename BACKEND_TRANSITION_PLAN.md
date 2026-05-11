# Backend Transition Plan

## 1. Executive summary

This plan defines how privateTutor should move from the current mock-only prototype to a safe Firebase / Genkit / Gemini backend in later PRs.

This PR is planning-only. It does not connect Firebase, Firestore, Firebase Storage, Gemini, Genkit, Gemini File Search, Google Search Grounding, retrieval, upload, persistence, or any external service.

## 2. Current mock architecture

- Next.js / TypeScript app shell with Hebrew RTL layout.
- Mock tutor behavior in `src/lib/tutor.ts`.
- Static mock workspace, file, learner memory, academic knowledge, and decision log data.
- Type-only provider and retrieval declarations.
- No server-side tutor route yet.
- No persistent storage.
- No API keys, secrets, environment files, package installs, or network calls.

## 3. Target backend architecture

- Frontend remains a Hebrew RTL learning workspace.
- Backend owns model calls, retrieval routing, memory write decisions, file indexing, structured output validation, and decision logging.
- Firebase Authentication identifies Nevo and future users.
- Firestore stores metadata, sessions, summaries, learner memory, academic knowledge metadata, decision logs, and provider status without secrets.
- Firebase Storage stores app-managed PDF/DOCX files.
- Genkit wraps AI workflows as server-side flows.
- Gemini is the first model provider for MVP.
- Gemini File Search is the first planned retrieval provider.
- Google Search Grounding is the first planned web search provider.

## 4. Server-side boundary

The first implementation phase should add a server-side tutor boundary without real services:

- A server-owned tutor request schema.
- A server-owned tutor response schema.
- Validation for work mode, cost mode, workspace scope, message content, citations, memory candidates, and decision log events.
- A mock provider as the default response engine.
- No frontend model calls.
- No API keys in frontend code.

## 5. Frontend/backend responsibility split

Frontend responsibilities:

- Render tutor workspace, modes, files, memory status, and messages.
- Send user intent and selected mode values to server boundaries.
- Display visible tutor responses and citations returned by the backend.
- Never hold provider secrets or call model/retrieval APIs directly.

Backend responsibilities:

- Validate requests.
- Route intent before retrieval.
- Apply cost-mode retrieval budgets.
- Call model, retrieval, storage, and web providers later.
- Separate visible responses from internal updates.
- Propose and write learner memory only when policy allows.
- Write technical Decision Log entries in English.

## 6. Firebase components planned

### Firebase Authentication

- Planned for identity and user scoping.
- Start with a simple authenticated user boundary.
- Nevo must decide whether MVP auth starts with Google login only.

### Firestore

- Planned for structured metadata and private user data.
- Stores workspaces, uploaded file metadata, sessions, summaries, learner memory, academic knowledge metadata, decision log entries, and provider settings without secrets.

### Firebase Storage

- Planned for app-managed PDF/DOCX files.
- MVP should support digital PDF/DOCX only.
- OCR-heavy workflows are out of scope for MVP.

## 7. Genkit flows planned

- `handleTutorMessageFlow`
- `classifyUploadedFileFlow`
- `retrieveContextFlow`
- `updateLearnerMemoryFlow`
- `proposeAdaptiveInstructionFlow`
- `generateSummariesFlow`
- `webSearchFlow`
- `runBehaviorTestFlow`

Each flow should begin mock-only or behind provider interfaces, then move to real providers only after schemas, tests, and secret handling are ready.

## 8. Gemini integration plan

- Gemini-first MVP.
- Server-side API calls only.
- Structured output required.
- Validate output before showing Nevo.
- Retry once with a repair prompt if structured output is invalid.
- Keep visible response separate from internal updates.
- Add model selection by cost mode later.
- Do not implement Gemini in this PR.

## 9. Retrieval provider boundary

- Add retrieval routing before any retrieval provider is connected.
- Use `RetrievalProvider` abstraction first.
- Gemini File Search is the planned MVP provider later.
- Do not retrieve the whole knowledge base by default.
- Cost modes must influence retrieval budget.
- Work modes must influence retrieval scope.
- Broad questions must ask clarification before expensive retrieval.

## 10. Learner Memory vs Academic Knowledge boundary

- Learner Memory stores how Nevo learns, pacing preferences, corrections, recurring difficulties, and teaching behavior rules.
- Academic Knowledge stores files, source metadata, summaries, topics, concepts, citations, and course material.
- These must remain separate collections and separate TypeScript concepts.
- Temporary Chat must not automatically write permanent memory or knowledge.

## 11. Decision Log boundary

- Decision Log is technical, English, private, and hidden from the main learning UI.
- It should record retrieval scope, web search use, memory write or non-write, file assignment, file indexing, topic classification, clarification, model/provider choice, cost mode choice, and fallback events.
- Decision Log storage should be backend-owned.

## 12. Secret handling rules

- Never commit API keys or secrets.
- Never store API keys in frontend code.
- Never store API keys in application-level TypeScript models.
- Provider settings may store provider name and status only.
- Real secrets must live in local `.env.local` later and deployment secret storage later.
- This PR creates no `.env` files.

## 13. Environment variable plan with placeholder names only

Placeholder names for later implementation planning:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `GEMINI_API_KEY`
- `GENKIT_ENV`
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_SEARCH_GROUNDING_ENABLED`

These are names only. No values are added in this PR.

## 14. Phased implementation order

1. Phase A — Backend boundary scaffolding, no services.
2. Phase B — Firebase project setup preparation.
3. Phase C — Firestore data model.
4. Phase D — Firebase Storage plan.
5. Phase E — Genkit flow scaffolding.
6. Phase F — Gemini integration.
7. Phase G — Retrieval integration.
8. Phase H — Memory integration.
9. Phase I — Web search.
10. Phase J — Behavior regression expansion.

## 15. Go/no-go checks before real service connection

Go only when:

- Request/response schemas exist and are tested.
- Mock provider remains the default fallback.
- Secrets are server-side only.
- Firebase project decisions are made by Nevo.
- Firestore and Storage rules are planned.
- Behavior tests cover guidance, local questions, simple facts, broad queries, cost modes, work modes, Temporary Chat, citations, and failure honesty.
- Decision Log events are defined.

No-go if:

- Any key would be exposed to frontend code.
- Retrieval routing is not defined.
- Learner Memory and Academic Knowledge are blurred.
- Firebase rules are not planned.
- Provider failures would be hidden.

## 16. Risks

- Connecting services before schemas and tests would make behavior harder to protect.
- Storing provider secrets in app models would create security risk.
- Retrieval without routing could increase cost and reduce tutor quality.
- Memory writes without policy could pollute learner memory.
- Web search without disclosure would violate source expectations.

## 17. Exact next implementation task

Implement Phase A: backend boundary scaffolding with mock provider only, including request/response schemas, validation shapes, and tests, with no external services connected.
