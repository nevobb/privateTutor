# PDF Reading Batch 8D.1 — Deep PDF Cost Mode Guard Report

## 1. Branch and HEAD
- Branch: `repair/controlled-deep-pdf-execution`
- HEAD: `04a6c47 docs: add post 8D Deep PDF runtime safety audit`

## 2. Files changed
Modified:
- `src/server/workspaces/uploadedFileApiService.ts`

New files:
- `tests/server/workspaces/deepPdfCostModePolicy.test.ts`

Memory/docs:
- `agent-memory/PDF_READING_BATCH_8D1_DEEP_PDF_COST_MODE_GUARD_REPORT.md`
- `agent-memory/DUAL_AGENT_SYNC_LOG.md` (sync entry appended)

## 3. Implementation summary

Four minimal changes to `uploadedFileApiService.ts`:

1. Added `import type { CostMode } from "../../types/index"`.

2. Added optional `options?: { costMode?: CostMode }` to `UploadedFileApiService.runChunkingLifecycleForFile` interface and implementation.

3. Threaded `costMode: options?.costMode` through to `maybeRunTextOnlyDocumentUnderstandingAfterChunking`.

4. Replaced the hardcoded `{ costMode: "Normal Learning" }` in the Deep PDF call with:
   ```ts
   const effectiveCostMode: CostMode = costMode ?? "Normal Learning";
   ```
   and passed `{ costMode: effectiveCostMode }` to `runDeepPdfUnderstanding`.

Added a clear TODO comment at the call site explaining the route-level gap and what needs to happen next.

## 4. Cost mode availability

**Verdict: cost mode is NOT natively available at the post-chunking lifecycle point.**

The chunks API route (`/api/workspaces/[workspaceId]/files/[fileId]/chunks/route.ts`) calls `uploadedFileApiService.runChunkingLifecycleForFile(authResult.user, workspaceId, fileId)` without any cost mode. The cost mode is a session/UI concept stored in React state (`page.tsx`) and sent only with tutor messages — it is not part of the file processing pipeline.

**Solution chosen:** Thread an optional `costMode` parameter through the call chain. The route still does not pass it (doesn't have it), so the default "Normal Learning" applies there. But callers who DO have the cost mode (e.g., future on-demand Deep PDF triggers with session context) can pass it explicitly. Tests can pass it to verify policy enforcement.

This is the narrowest safe option — no global state, no new infrastructure, fully backward compatible.

## 5. Policy behavior

```
runChunkingLifecycleForFile(user, workspaceId, fileId, options?)
  → options?.costMode  →  maybeRunTextOnlyDocumentUnderstandingAfterChunking({ costMode })
    → effectiveCostMode = costMode ?? "Normal Learning"
    → deepPdfOrchestrationService.runDeepPdfUnderstanding(userId, fileId, { costMode: effectiveCostMode })
      → deepPdfCachePolicy.evaluateDeepPdfCacheState({ costMode: effectiveCostMode, ... })
        → allowsFutureAutoRun: blocks "Cheap Practice", allows "Normal Learning" and "Deep Research"
```

## 6. Cheap Practice behavior

When `costMode = "Cheap Practice"` is passed:
1. `effectiveCostMode = "Cheap Practice"`
2. `runDeepPdfUnderstanding({ costMode: "Cheap Practice" })`
3. `evaluateDeepPdfCacheState({ costMode: "Cheap Practice", deepPdfStatus: "recommended", ... })`
4. `allowsFutureAutoRun` returns `false` (Cheap Practice blocked at line 133)
5. Cache returns `blocked_by_cost_mode` → `shouldRunDeepPdfProcessing = false`
6. Service returns `{ status: "skipped", skipReason: "blocked_by_cost_mode" }`
7. Chunking lifecycle continues normally — returns the `recommendedFile` (not completed)

**The chunking route today still uses "Normal Learning" as the effective default** because it doesn't pass costMode. This is the documented gap — addressed by the TODO comment.

## 7. Normal Learning / Deep Research behavior

When `costMode = "Normal Learning"` or `"Deep Research"`:
1. `allowsFutureAutoRun` returns `true`
2. Cache returns `eligible_for_future_auto_run` → `shouldRunDeepPdfProcessing = true`
3. Deep PDF execution proceeds (subject to API key, loader, and all other guards)

## 8. Cache/reuse behavior

Unchanged from Batch 8D. When `deepPdfStatus === "completed"` with matching identity, the cache returns `use_existing_result` regardless of cost mode — before any loader or provider call.

## 9. Tests added

### `tests/server/workspaces/deepPdfCostModePolicy.test.ts` (13 tests)

Tests operate at the `createUploadedFileApiService` integration level with full dependency injection.

**Cheap Practice (3 tests):**
- Deep PDF service receives Cheap Practice cost mode
- Chunking still succeeds (lifecycle not broken)
- `deepPdfStatus` does not become "completed"

**Normal Learning (3 tests):**
- Deep PDF service receives Normal Learning cost mode
- Chunking succeeds
- Deep PDF completes when quality gate recommends

**Deep Research (2 tests):**
- Deep PDF service receives Deep Research cost mode
- Deep PDF completes when quality gate recommends

**Default / no options (2 tests):**
- No costMode defaults to Normal Learning
- Chunking succeeds with no options

**Quality gate text-only (1 test):**
- Deep PDF not called when quality gate says use_text_only (regardless of cost mode)

**Completed reusable result (1 test):**
- Deep PDF not triggered when `deepPdfStatus` is already "completed" (shouldRecommendDeepPdf returns false)

**No deepPdfOrchestrationService (1 test):**
- Chunking succeeds safely when deep PDF service is absent

## 10. Validation results
- `npx tsc --noEmit` — ✅ passed
- `npx vitest run` — ✅ 67 files passed, 18 skipped; 807 tests passed, 121 skipped
- `npm run build` — ✅ passed
- `git diff --check` — ✅ passed
- `graphify update .` — ✅ 4240 nodes, 5832 edges, 287 communities

## 11. Not implemented
- Per-session cost mode propagation from the client chunks API route — the route does not send cost mode; this is the documented gap.
- Storing cost mode in uploaded file metadata so it can be re-read later.
- A new "Cheap Practice" Firestore field on the file record.
- Any global state for cost mode.

## 12. Risks / open decisions

### Route-level gap (main open decision)
The `/chunks` route still defaults to "Normal Learning" because it doesn't receive a cost mode from the client. The `workspaceFilesApiClient.ts` does not send it either. This means: a user in "Cheap Practice" mode who uploads a math-heavy PDF will still get Deep PDF auto-run attempted at chunking time.

**To fix completely:** The chunks route must accept an optional `costMode` query param or body field, and the client `runWorkspaceFileChunking(...)` must pass it. This is a controlled future change — it does not require touching the orchestration service or policy logic, only the route/client boundary.

**TODO comment added at the exact call site** (`uploadedFileApiService.ts`) explaining this and pointing to Batch 8D.1.

### Why this is acceptable for now
The Batch 8D.1 goal was to make cost mode testable and policy-enforceable through the full call chain — which is now achieved. Cheap Practice IS correctly blocked when the mode is available. The remaining gap is the route layer not forwarding it, which is a separate concern documented here.

## 13. Confirmation that no git add / commit / push was run
Confirmed:
- No `git add`
- No `git commit`
- No `git push`

## 14. Confirmation that no git pull was run
Confirmed:
- No `git pull`
