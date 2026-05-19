# Batch 5 / Phase 13 Report — Work Modes Policy Hardening

1. Branch used
- `codex/batch5-next-phase`

2. One step only confirmation
- Implemented work-mode guardrails in session execution path for `Temporary Chat`, `Practice`, `Research`, and `Build`.

3. Discovery summary
- Core work-mode enums and selectors already existed.
- Retrieval and memory execution paths needed hardening at service layer to guarantee policy behavior beyond provider intent.

4. Files changed
- `src/server/workspaces/sessionMessageApiService.ts`
- `src/server/tutor/schemas.ts`
- `tests/server/workspaces/sessionMessageApiService.test.ts`
- `agent-memory/BATCH5_PHASE13_WORK_MODES_REPORT.md`

5. Endpoint/API summary
- No public API shape changes.
- `POST /api/sessions/[sessionId]/messages` response contract unchanged.

6. Behavior summary
- Added service-level work-mode guardrails before retrieval execution:
  - `Temporary Chat`:
    - forces `learner_memory_update` to `none`
    - skips `processMemoryCandidate`
    - emits explicit `memory_not_written` event
  - `Practice`:
    - retrieval scope minimized to `none|session|topic` only (no `workspace|web`)
    - emits policy event for minimization
  - `Research`:
    - keeps broader scope and marks web scope as policy-allowed only
    - no web provider execution added in this phase
  - `Build`:
    - promotes retrieval scope to `workspace` for retrieval-enabled decisions
    - emits project-context policy event
- Added new decision event type: `work_mode_policy` (mapped to `decisionType: retrieval_scope`).

7. Tests added/updated
- Updated `sessionMessageApiService` tests to verify:
  - Temporary Chat skips memory processing and logs memory-not-written
  - Practice scope minimization while preserving budget caps
  - Research web policy eligibility event (without introducing web execution provider)
  - Build scope promotion to workspace

8. Commands run and pass/fail
- `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts tests/server/workspaces/learnerMemoryApiService.test.ts tests/server/workspaces/learnerMemoryApiRoute.test.ts tests/server/tutor/retrievalDecisionBoundary.test.ts tests/server/tutor.handler.test.ts`
  - Result: passed (33/33)
- `npm run build`
  - Result: passed
- `git diff --check`
  - Result: passed

9. Scope guard
- No provider additions.
- No web execution provider integration.
- No upload/extraction/storage changes.
- No package file changes.

10. Commit SHA
- not committed

11. PR link
- none yet

12. Exact next recommended task
- Phase 14 — web search execution boundary (Google Search Grounding MVP) with explicit justification/disclosure and decision-log conflict visibility.
