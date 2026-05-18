# Batch 2 — Partial Closure Report

Date: 2026-05-18 (Asia/Jerusalem)
Branch: `codex/batch2-partial-closure`

## Scope executed
- Phase 7.2 closure: workspace move API + data behavior + tests.
- Phase 15 subset closure: behavior tests limited to currently implemented architecture.
- No upload/indexing/retrieval-execution/memory-persistence/web-search feature work.

## Implemented changes
- Added server-only move endpoint:
  - `POST /api/workspaces/[workspaceId]/move`
  - Request: `currentPath` (required), `parentWorkspaceId?`, `stableIdentityNote?`
  - Response: standard workspace payload with unchanged `id` and move fields.
- Added move validation and path normalization (`"A/ B /C" -> "A / B / C"`).
- Added repository move operation that updates the existing workspace document in place:
  - sets `currentPath`
  - appends prior `currentPath` into `previousPaths` without duplicates
  - keeps `workspaceId` stable
  - refreshes `updatedAt` + `lastActivityAt`
  - updates legacy `path` array for backward compatibility
- Extended workspace API response/type surface with optional:
  - `currentPath`
  - `previousPaths`

## Behavior subset closure (Phase 15 subset)
Covered and enforced through focused tests:
- guidance-only stop behavior
- local-question stop behavior
- simple-fact avoids retrieval (current behavior)
- user correction handling
- temporary chat memory-write skip behavior
- cost-mode to model routing behavior

Primary evidence:
- `tests/behavior.test.ts`
- `tests/server/tutor/deepseekConfig.test.ts`

## Test results
### Passed (focused unit/route/behavior)
- `npx vitest run tests/server/workspaces/workspaceApiSchemas.test.ts tests/server/workspaces/workspaceApiService.test.ts tests/server/workspaces/workspaceMoveApiRoute.test.ts tests/server/workspaces/workspaceApiRoute.test.ts tests/behavior.test.ts tests/server/tutor/deepseekConfig.test.ts`
- Result: **7 files, 80 tests passed**

### Passed (emulator integration suites)
- `FIREBASE_WORKSPACE_EMULATOR_TEST=1 FIREBASE_WORKSPACE_API_EMULATOR_TEST=1 npx vitest run tests/server/workspaces/workspaceRepository.test.ts tests/firebase/workspaceApi.emulator.test.ts`
- Result: **2 files, 14 tests passed**
- Stabilization applied:
  - Replaced legacy mocked Firestore harness usage in these suites with direct emulator-backed integration.
  - Removed cross-suite global DB wipe race by isolating test data per run/user instead of clearing full Firestore between tests.

## Deferred items (intentional, out of Batch 2 scope)
- Upload/classify/indexing flows
- PDF page citation flows
- Retrieval execution engine
- Web-search disclosure runtime
- Persistent learner-memory write pipeline

## Batch 2 status
- Implementation scope completed.
- Acceptance criteria achieved (including emulator integration validation for the Batch 2 scope).
