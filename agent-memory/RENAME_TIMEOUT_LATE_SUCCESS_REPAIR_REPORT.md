# Rename Timeout / Late Success Repair Report

## 1. Brain files read
- `AGENTS.md`
- `agent-memory/PROJECT_BRAIN/00_CURRENT_STATE.md`
- `agent-memory/PROJECT_BRAIN/01_SYSTEM_PIPELINE_CONTRACTS.md`
- `agent-memory/PROJECT_BRAIN/02_CHANGE_IMPACT_MATRIX.md`
- `agent-memory/PROJECT_BRAIN/03_RISK_REGISTER.md`
- `agent-memory/PROJECT_BRAIN/04_AGENT_PREFLIGHT_PROTOCOL.md`
- `agent-memory/PROJECT_BRAIN/05_REGRESSION_SMOKE_PLAYBOOK.md`

## 2. Graphify queries run
- `graphify query "sessionApiClient timeout rename session"`
- `graphify query "WorkspaceSelector renameSession error timeout"`
- `graphify query "PATCH sessions sessionId route rename"`
- `graphify query "sessionRepository updateSession title updatedAt"`
- `graphify query "page.tsx handleRenameSession local session state"`

## 3. Impact prediction
- Changing `src/lib/sessions/sessionApiClient.ts` affects all operations that share `runSessionRequest(...)`:
  - list sessions
  - create session
  - rename session
  - delete session
- It does **not** affect message sending, because messages use `sessionMessagesApiClient`.
- It does **not** affect tutor/retrieval/Deep PDF unless unrelated files are touched.
- UI rename state could regress if client helpers changed shape or errors changed unexpectedly, because `WorkspaceSelector` only exits rename mode after `onRenameSession(...)` resolves.
- Safety proof needed:
  - timeout-budget test on the session client
  - existing rename success/error tests
  - existing rename/delete route tests
  - full suite/build validation

## 4. Root cause
- `src/lib/sessions/sessionApiClient.ts` was still using `const REQUEST_TIMEOUT_MS = 8000;`.
- `WorkspaceSelector` waits for the rename promise before closing rename mode.
- `page.tsx` updates local session state only after `renameSession(...)` returns successfully.
- Server rename path is synchronous and can still complete after the browser aborts.
- Result: the client can surface a 503/timeout while the rename actually succeeds later on the server, producing a false user-facing failure.

## 5. Fixes made
- Increased the shared session client timeout in:
  - [src/lib/sessions/sessionApiClient.ts](/Users/nevobiton/private-tutor-project/privateTutor/src/lib/sessions/sessionApiClient.ts:1)
- Added a regression test that fails if the client timeout drops below `25000ms`:
  - [tests/lib/sessions/sessionApiClient.test.ts](/Users/nevobiton/private-tutor-project/privateTutor/tests/lib/sessions/sessionApiClient.test.ts:1)

## 6. Timeout behavior after fix
- Before:
  - `sessionApiClient` hard abort: `8000ms`
- After:
  - `sessionApiClient` hard abort: `25000ms`
- This now matches the safer message-client timeout budget and gives rename enough time to finish in the same class of slow-but-valid environments where message sending already needed more room.

## 7. Rename UI behavior after fix
- No UI redesign was introduced.
- `WorkspaceSelector` still waits for the promise before exiting rename mode.
- `page.tsx` still updates local session state only after success.
- The intended behavioral improvement is narrower:
  - fewer false client aborts
  - fewer “rename failed” messages when the server would have succeeded moments later

## 8. Files changed
- [src/lib/sessions/sessionApiClient.ts](/Users/nevobiton/private-tutor-project/privateTutor/src/lib/sessions/sessionApiClient.ts:1)
- [tests/lib/sessions/sessionApiClient.test.ts](/Users/nevobiton/private-tutor-project/privateTutor/tests/lib/sessions/sessionApiClient.test.ts:1)
- [agent-memory/RENAME_TIMEOUT_LATE_SUCCESS_REPAIR_REPORT.md](/Users/nevobiton/private-tutor-project/privateTutor/agent-memory/RENAME_TIMEOUT_LATE_SUCCESS_REPAIR_REPORT.md:1)

## 9. Tests added / updated
- Added timeout-budget regression test in `tests/lib/sessions/sessionApiClient.test.ts`
  - verifies `REQUEST_TIMEOUT_MS >= 25000`
- Existing rename, create, fetch, and delete client tests kept passing.

## 10. Validation results
- `npx tsc --noEmit` ✅
- `npx vitest run` ✅
- `npm run build` ✅
- `git diff --check` ✅
- `graphify update .` ✅

## 11. Manual smoke checklist
1. Open a workspace with at least one conversation.
2. Rename a conversation to a new title.
3. Wait through a previously slow environment and confirm:
   - no early timeout banner appears
   - rename mode closes cleanly
   - new title is visible immediately after success
4. Rename another conversation again to confirm repeatability.
5. Delete a conversation and confirm delete still works normally.
6. Send a normal tutor message and confirm message flow was not affected.

## 12. Risks / open decisions
- This is the smallest safe fix, not a full UX redesign.
- If rename latency ever exceeds `25000ms`, the false-timeout pattern could still happen, though much less likely.
- A future refinement could separate read/write timeout budgets or add optimistic rename UI, but that is outside this batch.

## 13. Ready for Nevo manual smoke
- YES

## 14. Safety confirmations
- Tutor reasoning was not changed.
- Retrieval logic was not changed.
- Deep PDF behavior was not changed.
- Upload/extract/chunk backend behavior was not changed.
- Soft delete semantics were not changed.
- `primaryFileId` / `attachedFileIds` were not implemented.
- Learner memory was not implemented.
- No `git add` was run.
- No commit was created.
- No push was run.
- No `git pull` was run.
