# Current Task

## Status
Step 40C complete — conversation history passed to DeepSeek on every message.

## What was done in Step 40A
- Created `TutorProvider` interface (`src/server/tutor/tutorProviderInterface.ts`)
- Created `DeepSeekTutorProvider` (`src/server/tutor/deepseekTutorProvider.ts`)
  - Uses `deepseek-chat` for Cheap Practice + Normal Learning
  - Uses `deepseek-reasoner` (R1) for Deep Research
  - System prompt built from WorkMode + CostMode
- Created `providerRegistry.ts` — auto-selects DeepSeek when DEEPSEEK_API_KEY is set, falls back to mock
- Created `mockProviderAdapter.ts` — wraps existing mock as TutorProvider
- Updated `handleTutorRequest.ts` — uses provider registry
- Updated `sessionMessageApiService.ts` — default tutor call routes through provider registry
- Added `deepseek_provider` event type to `DecisionLogEvent`
- Added `.env.local.example` with DEEPSEEK_API_KEY placeholder
- No packages added. No tests broken. No Firebase cloud connection.

## To activate DeepSeek
1. Copy `.env.local.example` to `.env.local`
2. Set `DEEPSEEK_API_KEY=<your key>`
3. Run `npm run dev`

## Next proposed task
Step 40B — Smoke test DeepSeek in browser, verify real tutor responses flow end-to-end.
After that: Step 41 — Tutor Harness (Phase 2 from product roadmap).

## Roadmap
- Phase 1 (current): real AI tutor via DeepSeek ✓ provider layer done
- Phase 2: Tutor Harness (intent, retrieval, memory decisions)
- Phase 3: Math/Physics Tool Layer
- Phase 4: Learner State System
- Phase 5: Evaluation & Observability (Langfuse, promptfoo)

## Active provider decisions
- DeepSeek is the current AI provider (not Gemini — decision made 2026-05-18)
- Gemini remains the long-term target (Gemini File Search, Google Search Grounding)
- Provider abstraction in place — switching providers requires only providerRegistry.ts change

## Must follow
- `AGENT_TASK_PROTOCOL.md`
- `AGENTS.md`
- `agent-memory/PROJECT_STATE.md`
- this file

## Forbidden until explicitly approved
- Do not add Genkit.
- Do not add retrieval.
- Do not add learner memory persistence.
- Do not add file upload.
- Do not change package files unless explicitly approved.
- Do not deploy Firebase.
