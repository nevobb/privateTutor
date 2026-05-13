# Structured Mock Tutor Response Report

## Branch

`feat/structured-mock-tutor-response`

## Files changed

- `src/types/index.ts`
- `src/lib/tutor.ts`
- `src/server/tutor/schemas.ts`
- `src/server/tutor/mockTutorProvider.ts`
- `tests/server/tutor.handler.test.ts`
- `tests/server/auth/tutorRouteAuth.test.ts`
- `tests/server/workspaces/workspacePersistenceService.test.ts`
- `tests/firebase/tutorRouteAuth.emulator.test.ts`
- `tests/behavior.test.ts` (minimal compatibility updates only)
- `PROJECT_STATE.md`
- `NEXT_STEPS_FOR_NEVO.md`

## TutorResponse shape change

`TutorResponse` changed from legacy:

```ts
{
  message: TutorMessage;
  internalUpdates?: LearnerMemoryObservation[];
  mockRouting: {...};
}
```

to structured:

```ts
{
  message: TutorMessage;
  internalUpdate: TutorInternalUpdate;
}
```

Removed legacy `internalUpdates` and `mockRouting`.

## getMockTutorResponse signature change

`getMockTutorResponse` now accepts optional context stubs:

```ts
getMockTutorResponse(
  userMessage: string,
  workMode: WorkMode,
  costMode: CostMode,
  learnerMemory?: LearnerMemory,
  conversationHistory?: TutorMessage[]
): Promise<TutorResponse>
```

## InternalUpdate mapping summary

- `stoppedAfterLocalAnswer` semantics map to `internalUpdate.should_stop_progression`
- Retrieval routing semantics map to `internalUpdate.retrieval.scope`
- Web-search-like retrieval maps to `internalUpdate.retrieval.used`
- Memory write intent maps to `internalUpdate.learner_memory_update.needed`

Implemented deterministic mock intent cases:
- Guidance/hint requests: `guidance_only`, stop progression, no retrieval, no memory write
- Local/personal questions: local question detected, stop progression, no retrieval
- Simple factual/regular learning: no progression stop, no retrieval
- User correction/preference: learner memory update required (`requires_approval` / `small_auto`)
- Research mode: retrieval used with `topic` or `workspace` (and `web` for explicit freshness cues)
- Temporary Chat: learner memory update forced off

## Server schema validation summary

`validateTutorResponse` now requires:
- `message` with `id`, `role: "tutor"`, non-empty `content`, optional citations
- `internalUpdate` with required nested objects:
  - `detected_intent`, `confidence`, `should_stop_progression`
  - `local_question`
  - `retrieval`
  - `learner_memory_update`
  - `knowledge_base_action`
  - `decision_log_entries` array

Legacy `mockRouting/internalUpdates` validation removed.

## Tests updated

- Updated server handler tests to assert `internalUpdate` fields
- Updated route auth tests to mock/assert structured response shape
- Updated workspace persistence unit test helper response shape
- Updated Firebase tutor auth emulator test response assertion
- Updated `tests/behavior.test.ts` minimally for compatibility only (no full PR 33C rewrite)

## What did NOT change

- No Gemini integration
- No Genkit integration
- No real retrieval provider
- No memory persistence implementation
- No Firebase/Auth verifier changes
- No workspace API/UI changes
- No Firestore/Storage rules changes
- No package file changes

## Commands run

- `npm run build` — PASS
- `npm run lint` — PASS (0 errors, 5 pre-existing warnings)
- `npx vitest run` — PASS (110 passed, 87 skipped)
- `git diff --check` — PASS

## Exact next task

**PR 33C — Rewrite behavior regression tests to assert structured `internalUpdate.*` semantics (T001–T013 from `docs/09_Behavior_Regression_Test_Suite.md`).**
