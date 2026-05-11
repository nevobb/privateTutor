# Workspace Persistence Boundary Planning Report

## 1. Branch used

`planning/workspace-persistence-boundary`

## 2. Models used

- Main Codex: `gpt-5.3-codex`
- Writer subagents: `gpt-5.4-mini`
- Reviewer subagents: `gpt-5.4-mini`

## 3. Subagents used

- Writer A: data model planning
- Writer B: ownership and write policy
- Writer C: route and repository contracts
- Writer D: documentation and draft report
- Reviewer E: security review
- Reviewer F: integration review

## 4. File ownership map

- Writer A: `planning/workspace_persistence_data_model_plan.md`
- Writer B: `planning/workspace_persistence_ownership_policy.md`
- Writer C: `planning/workspace_persistence_route_contracts.md`
- Writer D: `docs/firebase/WORKSPACE_PERSISTENCE_BOUNDARY.md`, `planning/workspace_persistence_boundary_report_draft.md`
- Main Codex: `PROJECT_STATE.md`, `NEXT_STEPS_FOR_NEVO.md`, `DECISION_LOG.md`, `WORKSPACE_PERSISTENCE_BOUNDARY_PLANNING_REPORT.md`

## 5. Files added

- `planning/workspace_persistence_data_model_plan.md`
- `planning/workspace_persistence_ownership_policy.md`
- `planning/workspace_persistence_route_contracts.md`
- `docs/firebase/WORKSPACE_PERSISTENCE_BOUNDARY.md`
- `planning/workspace_persistence_boundary_report_draft.md`
- `WORKSPACE_PERSISTENCE_BOUNDARY_PLANNING_REPORT.md`

## 6. Files changed

- `PROJECT_STATE.md`
- `NEXT_STEPS_FOR_NEVO.md`
- `DECISION_LOG.md`

## 7. Data model summary

- Planned user-owned path root remains `users/{userId}/...`.
- Planned workspace persistence paths:
  - `users/{userId}/workspaces/{workspaceId}`
  - `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}`
  - `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}/messages/{messageId}`
- Planned decision log path is user-level:
  - `users/{userId}/decisionLog/{entryId}`
  with `workspaceId` and `sessionId` references for context.
- Minimal fields are defined for user/workspace/session/message/decision-log docs with lightweight documents only.
- File binaries, learner memory persistence, academic knowledge persistence, and retrieval indexes are explicitly out of scope.

## 8. Ownership/write policy summary

- Ownership derives from authenticated `request.auth.uid`, never client-supplied `userId`.
- Workspaces and sessions are user-owned and user-readable.
- Message writes are split by role:
  - user messages from authenticated user context
  - tutor/tool/system messages server-written
- Decision log entries are planned as server-owned writes and private technical records.
- Retention/deletion is planning-only; archive-first direction is documented.
- Future rules tests are specified for cross-user denial, unauthenticated denial, path constraints, and server-owned field protection.

## 9. Route/repository contract summary

- Proposed future server boundaries:
  - `src/server/workspaces/*`
  - `tests/server/workspaces/*`
- Proposed minimal contracts:
  - `createWorkspace`
  - `listWorkspaces`
  - `getWorkspace`
  - `createSession`
  - `appendMessage`
  - `listSessionMessages`
  - `writeDecisionLogEntry`
- `POST /api/tutor` future flow is planned as:
  1. trusted auth uid
  2. workspace ownership validation
  3. append user message
  4. call mock tutor now (Gemini later behind same boundary)
  5. append tutor message
  6. return visible response
- Next implementation slice is intentionally narrow and avoids app redesign.

## 10. Documentation summary

- Added `docs/firebase/WORKSPACE_PERSISTENCE_BOUNDARY.md` as the high-level emulator-first boundary note.
- Added `planning/workspace_persistence_boundary_report_draft.md` as a concise implementation-phase draft summary.
- Documentation explicitly states no cloud wiring, no secrets, no env files, no production-readiness claims.

## 11. Reviewer findings summary

- Security reviewer findings:
  - current broad `firestore.rules` owner-write scope is too wide for future server-owned collections.
  - route/workspace ownership validation must be explicit before any persistence writes in the next implementation PR.
  - additional path-specific Firestore rule tests are needed before broader persistence.
- Integration reviewer findings:
  - planning fits current repo structure and can stay narrow.
  - mock tutor behavior can remain intact with persistence boundary layered around it.
  - package changes are not required for this planning PR.
  - repo can move to workspace persistence implementation after this planning pass.

## 12. Disagreements or rejected options

- Rejected broad persistence scope that includes file upload, learner memory, academic knowledge, retrieval, Gemini, or Genkit.
- Rejected workspace-scoped-only decision logs for phase one in favor of user-level decision logs with workspace/session references.
- Rejected runtime code or rules changes in this planning PR.

## 13. What was intentionally not implemented

- Firestore runtime persistence code
- Firestore SDK/Admin runtime initialization
- Firestore rules changes
- Storage upload implementation
- Gemini/Genkit integration
- Retrieval integration
- Learner memory persistence
- Academic knowledge persistence
- Cloud Firebase connection
- Env/secrets setup

## 14. Whether Firestore runtime code was added

No.

## 15. Whether Firestore rules were changed

No.

## 16. Whether Storage upload was added

No.

## 17. Whether Gemini/Genkit was added

No.

## 18. Whether retrieval/memory persistence was added

No.

## 19. Whether env files were added

No.

## 20. Whether secrets were added

No.

## 21. Whether real project IDs were added

No.

## 22. Whether Firebase cloud was connected

No.

## 23. Whether app remains mock-only outside Auth

Yes.

## 24. Whether repo is ready for workspace persistence implementation

Yes, for a narrow emulator-only implementation focused on workspace/session/message persistence boundaries and decision-log write contracts.

## 25. Exact next recommended task

Implement the emulator-only workspace persistence first slice: `createWorkspace`, `createSession`, `appendMessage`, and ownership-validated `POST /api/tutor` persistence ordering, while keeping Storage upload, Gemini/Genkit, retrieval, learner memory persistence, and academic knowledge persistence out of scope.
