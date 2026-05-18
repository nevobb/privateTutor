# Current Task

## Status
Batch 4 / Phase 8 implemented and validated on branch, pending merge via PR #43 — metadata-first file intake/classify/index lifecycle server-side (`/api/workspaces/[workspaceId]/files` GET/POST), with decision-log coverage and passing focused tests.
Batch 3 complete — retrieval decision boundary contract implemented (read-only, no retrieval execution), with decision-log wiring and passing matrix/provider/service tests.
Batch 2 complete — Phase 7.2 move flow + Phase 15 subset closures implemented and validated (including emulator integration suites).
Step 41E complete — diagnostics UX polish and sidebar developer toggle added.
Step 41D complete — diagnostics panel and composer layout fix shipped.
Step 41C complete — decision trace diagnostics API added (`GET /api/decision-log`).
Step 41B complete — harness decision events now persist through session message API decision-log path.
Step 40B complete — DeepSeek smoke test passed (real provider + persistence + isolation).
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

## What was done in Step 40B
- Added dedicated smoke suite: `tests/firebase/deepseekSmoke.emulator.test.ts`
  - Uses real DeepSeek provider through the real route handlers
  - Verifies 3 work/cost scenarios:
    - Learning + Normal Learning
    - Practice + Cheap Practice
    - Research + Deep Research
  - Confirms `201` responses and transcript persistence (`user` + `tutor` messages)
  - Confirms cross-user isolation (`GET`/`POST` return `404`)
- Added provider safety suite: `tests/server/tutor/deepseekProviderSafety.test.ts`
  - Missing API key => mock fallback
  - Upstream non-ok => bounded error
  - Timeout/network failure => exception path validated
- Added report: `DEEPSEEK_SMOKE_TEST_REPORT.md`

## Next proposed task
Batch 4 / Phase 9 (A: metadata-only summary lifecycle) — add summary status/contract flow only, without generating real summaries from file content, after approval.

## What was done in Batch 4 / Phase 8
- Added `POST /api/workspaces/[workspaceId]/files`:
  - Validates `fileName`, `sourceType` (`pdf|docx`), optional `storagePath` / `topicHint`
  - Orchestrates metadata creation + classification + indexing lifecycle
- Added `GET /api/workspaces/[workspaceId]/files` for workspace file metadata listing.
- Added uploaded files domain layer:
  - `src/server/workspaces/uploadedFileRepository.ts`
  - `src/server/workspaces/uploadedFileApiService.ts`
  - `src/server/workspaces/uploadedFileApiSchemas.ts`
- Added deterministic classification baseline:
  - topic inference from `topicHint` or filename
  - confidence scoring
  - assignment mapping: `assigned` vs `needs-review`
- Added indexing lifecycle transitions in orchestrated POST flow:
  - success: `uploaded -> indexing -> indexed`
  - internal failure fallback: `indexingStatus=failed`
- Added decision-log events for:
  - `file_assignment`
  - `topic_classification`
  - `file_indexing`
- Extended shared types for Phase 8 compatibility:
  - `FileIndexingStatus` includes `uploaded` and `indexing` while keeping legacy statuses
  - `DecisionLogEntry.decisionType` includes `topic_classification` and `file_indexing`
- Added report:
  - `agent-memory/BATCH4_PHASE8_REPORT.md`
- Scope boundaries kept explicit:
  - no binary upload
  - no Firebase Storage ingestion
  - no text extraction
  - no real vector/chunk index build
  - no retrieval execution
  - no summary generation
  - `indexingStatus` is lifecycle-only bookkeeping in this phase

## Batch 4 / Phase 8 validation note
- Focused unit + route + emulator suites pass, including:
  - API validation cases (`401/400/404/201`)
  - metadata persistence and ownership boundaries
  - indexing transition success/failure paths
  - decision-log read compatibility and event presence

## What was done in Batch 3
- Added retrieval decision boundary contract fields (snake_case):
  - `needs_retrieval`
  - `retrieval_scope`
  - `max_chunks`
  - `max_tokens`
  - `should_ask_clarification_first`
- Extended DeepSeek harness contract and parser validation to accept retrieval decision fields.
- Added deterministic fallback decision engine for matrix-stable behavior when retrieval fields are missing/invalid.
- Stored decision contract in `internalUpdate.retrieval_decision` (backward-compatible optional field).
- Kept retrieval execution unchanged:
  - `retrieval.used` remains false (decision-only phase)
  - no source fetch/chunk execution
- Added retrieval boundary decision-log event and mapped it to `decisionType: retrieval_scope`.
- Added report: `agent-memory/BATCH3_DECISION_BOUNDARY_REPORT.md`.

## Batch 3 validation note
- Parser, matrix, provider integration, and service/log integration suites pass.
- No API endpoint additions in this batch.

## What was done in Batch 2
- Added workspace move API route:
  - `POST /api/workspaces/[workspaceId]/move`
  - Validation: `currentPath` required + normalized, optional `parentWorkspaceId` / `stableIdentityNote`
- Added repository/service move behavior with stable identity:
  - `workspaceId` unchanged
  - `currentPath` updated
  - `previousPaths` append old value without duplicates
  - `updatedAt` / `lastActivityAt` refreshed
  - legacy `path` array kept for backward compatibility
- Added tests for move schema/service/route and behavior subset coverage artifacts.
- Added report: `agent-memory/BATCH2_PARTIAL_CLOSURE_REPORT.md`

## Batch 2 validation note
- Focused non-emulator test suites pass.
- Emulator integration suites for the Batch 2 scope now pass after test harness stabilization; see Batch 2 report for command output and details.

## What was done in Step 41 (current slice)
- Added Harness JSON contract prompt for DeepSeek (`src/server/tutor/deepseekHarnessPrompt.ts`)
- Integrated harness parsing into `DeepSeekTutorProvider`:
  - Parses structured JSON response when available
  - Maps classification fields into `internalUpdate`
  - Adds explicit `harness_classification` / `harness_fallback` decision events
  - Falls back safely to default classification when JSON parsing fails
- Added/used harness types parser (`src/server/tutor/harnessTypes.ts`)
- Added tests:
  - `tests/server/tutor/harnessTypes.test.ts`
  - `tests/server/tutor/deepseekHarnessIntegration.test.ts`

## What was done in Step 41B
- Wired provider `decisionLogEvents` persistence into `sessionMessageApiService` using `writeDecisionLogEntry`
- Added safe event-to-decision mapping:
  - `memory_not_written` -> `memory_not_written`
  - provider/harness/validation events -> `model_provider`
- Added service-level assertions that decision-log writes occur for DeepSeek/harness events
- Kept message flow and response shape unchanged

## What was done in Step 41C
- Added decision-log read capability in repository:
  - `listDecisionLogEntries(userId, { workspaceId?, sessionId?, limit? })`
- Added diagnostics API schema/service/route:
  - `src/server/workspaces/decisionLogApiSchemas.ts`
  - `src/server/workspaces/decisionLogApiService.ts`
  - `GET /api/decision-log` in `src/app/api/decision-log/route.ts`
- Added route tests for auth, validation, error handling, and success serialization:
  - `tests/server/workspaces/decisionLogApiRoute.test.ts`
- No chat UX changes; diagnostics is API-only in this slice.

## What was done in Step 41D
- Added diagnostics client data layer:
  - `src/lib/diagnostics/decisionLogApiClient.ts`
  - `src/lib/diagnostics/decisionLogApiTypes.ts`
- Integrated a collapsed-by-default, read-only Diagnostics panel in `TutorConversation`:
  - Loads by active `workspaceId` + `sessionId` with `limit=20`
  - Supports states: disabled/loading/empty/error/success
  - Re-fetches after tutor response append
- Refactored chat composer layout:
  - Send button moved outside textarea (fixed left, non-floating)
  - Removed overlay padding dependency
  - Preserved Enter/Shift+Enter behavior and `dir=\"auto\"`
- Added tests:
  - `tests/lib/diagnostics/decisionLogApiClient.test.ts`
  - `tests/components/tutor/TutorConversation.test.tsx`

## What was done in Step 41E
- Added sidebar `Developer diagnostics` toggle under Theme section.
- Added localStorage persistence/hydration for the toggle:
  - key: `privateTutor.devDiagnostics.enabled`
  - default: `false`
- Wired `developerDiagnosticsEnabled` from page container into `TutorConversation`.
- Gated diagnostics behavior when disabled:
  - hide diagnostics panel
  - skip diagnostics fetch and refresh triggers
- Polished diagnostics presentation:
  - decision labels (`model_provider` -> `Model`, `memory_not_written` -> `Memory`)
  - local timestamp format `HH:mm:ss`
  - improved disabled/loading/empty/error copy
- Added helper tests for toggle persistence parsing/serialization:
  - `tests/components/pageDiagnosticsToggle.test.ts`

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
