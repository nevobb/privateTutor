# Batch 5 / Phase 14 — Web Search Execution (Policy-Gated)

## Scope implemented
- Added web-search execution path in `sessionMessageApiService` when provider retrieval decision requests `retrieval_scope=web`.
- Kept execution policy-gated and internal:
  - executes only in `Research` mode
  - requires freshness/recentness cue in user message
  - otherwise skips with explicit rationale and decision-log event
- Added deterministic mock web provider (no external integration) for Phase 14 execution scaffolding.
- Added web-search decision-log lifecycle events and mapped them to `decisionType: web_search`.

## Key behavior
- `web_search_requested` when web execution is policy-eligible and starts.
- `web_search_executed` when sources are returned and citations attached.
- `web_search_skipped` when policy blocks execution, no results, or provider fails.
- `web_search_conflict` when returned sources include both supporting and conflicting stances.

## Files changed
- `src/server/tutor/webSearchProvider.ts` (new)
- `src/server/tutor/schemas.ts`
- `src/server/workspaces/sessionMessageApiService.ts`
- `tests/server/workspaces/sessionMessageApiService.test.ts`

## Validation
- `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts` ✅
- `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts tests/server/tutor/retrievalDecisionBoundary.test.ts tests/server/tutor/deepseekHarnessIntegration.test.ts` ✅
- `npm run build` ✅
- `git diff --check` ✅

## Boundaries preserved
- No real external web provider integration.
- No package/dependency changes.
- No public API shape changes for `POST /api/sessions/[sessionId]/messages`.
