# Behavior Internal Update Regression Report

## Branch

`test/behavior-internal-update-regressions`

## Files changed

- `tests/behavior.test.ts`
- `PROJECT_STATE.md`
- `NEXT_STEPS_FOR_NEVO.md`

## Behavior tests rewritten

`tests/behavior.test.ts` was rewritten to validate structured `internalUpdate` semantics rather than legacy string-heavy expectations.

Key changes:
- Removed legacy dependency on `mockRouting`/`internalUpdates`
- Reduced brittle exact-Hebrew-copy matching
- Kept Hebrew checks only as sanity constraints (non-empty + Hebrew characters)
- Added explicit semantic assertions for retrieval, progression stop behavior, and learner memory update behavior

## T001–T013 coverage summary

- **T001** Guidance only does not solve: `guidance_only`, stop progression, no retrieval
- **T002** Local/personal question stops locally: `local_question.detected=true`, stop progression
- **T003** Regular/simple learning avoids retrieval: `factual_or_regular`, retrieval off
- **T004** User correction proposes correction memory update
- **T005** User preference proposes preference memory update
- **T006** Temporary Chat avoids permanent memory write
- **T007** Research mode uses retrieval with `topic` scope
- **T008** Deep Research broadens retrieval to `workspace`
- **T009** Research + freshness cue routes to `web`
- **T010** Cheap Practice stays source-light (`retrieval.used=false`, no citations)
- **T011** Memory and academic knowledge remain separated at data model level
- **T012** InternalUpdate shape completeness assertions
- **T013** Hebrew RTL visible-response sanity

## InternalUpdate assertions summary

The rewritten suite now directly checks:
- `detected_intent`
- `confidence` (where relevant)
- `should_stop_progression`
- `local_question.detected`
- `retrieval.used`
- `retrieval.scope`
- `retrieval.source_ids`
- `learner_memory_update.needed`
- `learner_memory_update.update_type`
- `learner_memory_update.memory_type`
- `learner_memory_update.confidence`
- presence of top-level `knowledge_base_action` and `decision_log_entries`

## Mock behavior adjustments

No `src/lib/tutor.ts` changes were required in this PR. Existing deterministic mock behavior already supported the required structured assertions.

## Commands run

- `npm run build` — PASS
- `npm run lint` — PASS (0 errors, 5 pre-existing warnings)
- `npx vitest run` — PASS (114 passed, 87 skipped)
- `git diff --check` — PASS

## What did NOT change

- No Gemini integration
- No Genkit integration
- No real retrieval implementation
- No memory persistence implementation
- No Firebase/Auth/workspace API/UI changes
- No route changes
- No package file changes
- No rules/env/secrets changes

## Exact next task

Run a manual browser smoke test for tutor UX (recommended), then proceed to the session API boundary if smoke results are clean.
