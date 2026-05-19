# Batch 5 / Phase 11 Report — Memory

1. Branch used
- `codex/batch5-next-phase`

2. One step only confirmation
- Implemented Phase 11 memory slice: candidate policy + write policy + memory viewer CRUD/approval.

3. Discovery summary
- Learner-memory intent and confidence already exist in `internalUpdate.learner_memory_update` from provider/harness.
- Existing app UI showed only mock memory panel and had no user-memory API boundary.

4. Files added
- `src/server/workspaces/learnerMemoryRepository.ts`
- `src/server/workspaces/learnerMemoryApiSchemas.ts`
- `src/server/workspaces/learnerMemoryApiService.ts`
- `src/app/api/learner-memory/route.ts`
- `src/app/api/learner-memory/[observationId]/route.ts`
- `src/lib/memory/learnerMemoryApiTypes.ts`
- `src/lib/memory/learnerMemoryApiClient.ts`
- `tests/server/workspaces/learnerMemoryApiService.test.ts`
- `tests/server/workspaces/learnerMemoryApiRoute.test.ts`
- `agent-memory/BATCH5_PHASE11_MEMORY_REPORT.md`

5. Files changed
- `src/server/workspaces/sessionMessageApiService.ts`
- `tests/server/workspaces/sessionMessageApiService.test.ts`
- `src/components/memory/MemoryPanel.tsx`
- `src/app/page.tsx`

6. Endpoint/API summary
- Added `GET /api/learner-memory?workspaceId?`.
- Added `PATCH /api/learner-memory/[observationId]` with actions: `edit|approve|reject`.
- Added `DELETE /api/learner-memory/[observationId]`.

7. Auth/ownership summary
- All routes use authenticated user from token.
- Repository paths are user-scoped under `users/{userId}/learnerMemory`.
- Cross-user access resolves to safe not-found/update-fail behavior.

8. Persistence summary
- Added learner-memory observation repository with create/list/get/update/delete.
- Added memory write policy integration in session message flow:
  - high confidence + small_auto + no contradiction/deletion-like intent => auto save as `active`
  - otherwise => save as `tentative` and requires approval
  - decision log written as `memory_write` or `memory_not_written`

9. UI summary
- Replaced mock memory panel with real memory viewer data.
- Added actions in panel: view, edit, delete, approve, reject.

10. Tests added
- Service tests for memory write policy (`auto-save` vs `requires approval`).
- Route tests for GET/PATCH/DELETE learner-memory boundary.
- Session-message service tests updated for memory-candidate processing call.

11. Commands run and pass/fail
- `npx vitest run tests/server/workspaces/learnerMemoryApiService.test.ts tests/server/workspaces/learnerMemoryApiRoute.test.ts tests/server/workspaces/sessionMessageApiService.test.ts tests/server/workspaces/workspaceFileSummaryApiRoute.test.ts tests/server/workspaces/uploadedFileApiService.test.ts`
  - Result: passed (32/32)
- `npm run build`
  - Result: passed
- `git diff --check`
  - Result: passed

12. Emulator test result, if run
- Not run in this slice.

13. Whether backend/API/Firebase/package files changed
- Backend/API files changed: yes.
- Firebase rules/deploy: no changes.
- package files: no changes.

14. Whether Gemini/Genkit/retrieval/memory/Storage added
- Gemini: no change
- Genkit: no
- Retrieval: no new retrieval provider changes
- Memory persistence/viewer: yes (Phase 11)
- File upload/storage ingestion: no

15. Commit SHA
- not committed

16. PR link
- none yet

17. Exact next recommended task
- Phase 12: cost-mode budget verification hardening in execution path (Cheap/Normal/Deep budget and policy assertions).
