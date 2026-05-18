# Batch 3 — Retrieval Decision Boundary Report

Date: 2026-05-18 (Asia/Jerusalem)
Branch: `codex/batch3-retrieval-boundary`

## Scope executed
- Implemented retrieval **decision boundary only** (no retrieval execution).
- Added structured decision contract to harness parsing and provider internal update.
- Persisted retrieval-boundary decisions into decision log events.

## Decision contract implemented
Structured snake_case fields:
- `needs_retrieval`
- `retrieval_scope`
- `max_chunks`
- `max_tokens`
- `should_ask_clarification_first`

Storage location:
- `internalUpdate.retrieval_decision` (backward-compatible optional field)

## Matrix outcomes (pass)
| Scenario | Expected | Observed |
|---|---|---|
| Simple fact | no retrieval | `needs_retrieval=false`, `retrieval_scope=none` |
| Broad question | clarification-first | `should_ask_clarification_first=true`, `needs_retrieval=false` |
| Active-context question | retrieval needed | `needs_retrieval=true`, scoped decision returned |
| Cheap Practice | low budget | `max_chunks=2`, `max_tokens=700` |
| Deep Research | broader scope + higher budget | `retrieval_scope=workspace`, `max_chunks=8`, `max_tokens=2800` |

## Decision-log integration
- Provider emits retrieval-boundary event (`type: retrieval_scope`) with summarized decision values.
- Service mapping persists this event as `decisionType: retrieval_scope`.
- Existing mappings (`model_provider`, `memory_not_written`) unchanged.

## Validation results
### Passed
- `npx vitest run tests/server/tutor/harnessTypes.test.ts tests/server/tutor/retrievalDecisionBoundary.test.ts tests/server/tutor/deepseekHarnessIntegration.test.ts tests/server/workspaces/sessionMessageApiService.test.ts tests/server/tutor/deepseekProviderSafety.test.ts`
- `npx vitest run tests/server/tutor.handler.test.ts tests/server/tutor.schemas.test.ts tests/server/workspaces/sessionMessageApiRoute.test.ts tests/server/workspaces/decisionLogApiRoute.test.ts`

### Outcome
- All targeted Batch 3 suites passed.

## Explicitly deferred to later phases
- Retrieval execution / document fetching
- Source chunk selection and citation from fetched material
- Upload/index pipelines
- Learner-memory persistence flow changes
