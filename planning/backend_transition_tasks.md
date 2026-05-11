# Backend Transition Tasks

## Phase A — Backend boundary scaffolding, no services

- Define server-side API boundary for tutor responses.
- Keep mock provider as default.
- Add request and response schemas.
- Add validation shapes.
- Add tests for valid requests, invalid requests, mock responses, citations, memory candidates, and routing metadata.
- Do not connect Firebase, Gemini, Genkit, retrieval, storage, or persistence.

## Phase B — Firebase project setup preparation

- Document required Firebase services: Authentication, Firestore, and Storage.
- Document manual Firebase console steps.
- Plan placeholder environment variable names.
- Do not commit secrets.
- Do not add `.env` or `.env.local`.
- Confirm whether Firebase Emulator should be used first.

## Phase C — Firestore data model

- Plan collections for workspaces, uploaded file metadata, sessions, session summaries, learner memory, academic knowledge metadata, decision log entries, and provider settings without secrets.
- Keep Learner Memory separate from Academic Knowledge.
- Define MVP status for each collection before implementation.
- Plan Firestore security rules before writing data.

## Phase D — Firebase Storage plan

- Define upload path conventions by user, workspace, and file ID.
- Define file metadata lifecycle: created, assigned, queued, indexed, failed.
- Support digital PDF/DOCX only for MVP.
- Do not build OCR-heavy workflow.
- Do not implement upload in this phase.

## Phase E — Genkit flow scaffolding

- Plan `handleTutorMessageFlow`.
- Plan `classifyUploadedFileFlow`.
- Plan `retrieveContextFlow`.
- Plan `updateLearnerMemoryFlow`.
- Plan `proposeAdaptiveInstructionFlow`.
- Plan `generateSummariesFlow`.
- Plan `webSearchFlow`.
- Plan `runBehaviorTestFlow`.
- Start flows as mock-only or interface-backed.
- Add tests before real provider calls.

## Phase F — Gemini integration

- Server-side only.
- Structured output required.
- Validate output before use.
- Retry repair once for invalid JSON.
- Never expose frontend keys.
- Keep visible response separate from internal updates.
- Add cost-mode model selection later.

## Phase G — Retrieval integration

- Add RetrievalProvider abstraction first.
- Use Gemini File Search as MVP provider later.
- Do not retrieve the whole knowledge base by default.
- Add retrieval routing before retrieval.
- Apply cost-mode-aware retrieval budgets.
- Test simple fact, broad query, active file, cross-workspace, and source citation behavior.

## Phase H — Memory integration

- Add rolling session summary.
- Add durable learner memory.
- Add candidate memory updates.
- Give user corrections priority.
- Do not automatically delete or archive meaningful memories early.
- Keep Temporary Chat from permanent memory by default.

## Phase I — Web search

- Add WebSearchProvider abstraction first.
- Add Google Search Grounding later.
- Require source disclosure whenever web search is used.
- Log web search decisions in Decision Log.
- Do not use web search by default in Cheap Practice.

## Phase J — Behavior regression expansion

- Write tests before real provider calls.
- Keep mock behavior tests.
- Provider tests must use mocks, not live services.
- Cover guidance only, local question stop, broad query clarification, simple fact no retrieval, user correction priority, web search disclosure, source citations, Cheap Practice budget, Temporary Chat memory policy, and tool failure honesty.
