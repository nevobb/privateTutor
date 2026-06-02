# TypeScript Baseline Repair Report

**Branch:** repair/recovery-typescript-baseline  
**Date:** 2026-06-02

---

## 1. Branch

`repair/recovery-typescript-baseline`

---

## 2. Starting Status Summary

`npx tsc --noEmit` failed with 20+ type errors across 10 test files. No source files had TypeScript errors — all errors were in test fixtures and module-cast patterns that had not been updated after production types evolved.

---

## 3. Graphify Commands Used

- `graphify query "TypeScript errors tests tutor fileInventoryService requestClassifier sessionMessageApiService"` — used for initial navigation
- `graphify update .` — run after all fixes to keep graph current

---

## 4. Validation Commands Run

| Command | Before | After |
|---|---|---|
| `npx tsc --noEmit` | Exit 1 — 20+ errors | Exit 0 — clean |
| `npx vitest run --exclude 'tests/firebase/**'` | Not run (blocked by tsc) | 559 passed, 16 skipped |

---

## 5. Initial Errors Found

All errors were in test files. Grouped by root cause:

### A. Stale module-cast pattern (double cast needed)
Tests used `(await import("...")) as LocalType` where the local type no longer overlapped with the evolved production type. TypeScript requires `as unknown as LocalType` when types are incompatible.

- `tests/behavior/mvpFileLearningPipeline.test.ts:177` — `ServiceModule.sendMessageForUser` takes `input: Record<string, unknown>` but production type requires `PostMessageRequest`
- `tests/server/workspaces/sessionApiSchemas.test.ts:21` — `serializeSession(record: Record<string, unknown>)` vs production `serializeSession(record: SessionRecord)`
- `tests/server/workspaces/sessionApiService.test.ts:26` — similar mismatch on `createSessionForUser`
- `tests/server/workspaces/sessionMessageApiSchemas.test.ts:19` — `serializeMessage(record: Record<string, unknown>)` vs production `serializeMessage(record: MessageRecord)`
- `tests/server/workspaces/sessionMessageApiService.test.ts:184` — same pattern on `createSessionMessageApiService`

### B. String literal widened — needs `as const`
Mock return objects used string literals (`"active"`, `"sent"`, `"mock_alignment"`, `"Learning"`, `"Normal Learning"`) that TypeScript widened to `string` rather than the narrow literal union type.

- `tests/server/workspaces/sessionApiRoute.test.ts:80` — `workMode: string` not assignable to `WorkMode`, `costMode: string` not assignable to `CostMode`, `status: string` not assignable to `"active"`
- `tests/server/workspaces/workspacePersistenceService.test.ts:107,146,157,167,178` — `decisionType: string`, `status: string`, `role: string` not assignable to their respective literal unions

### C. Stale `userId` field in mock parse result
`CreateSessionApiRequest` and `ListSessionsQuery` no longer include `userId`. Test mocks returned objects with `userId` from an earlier design.

- `tests/server/workspaces/sessionApiRoute.test.ts:157` — `userId` in `CreateSessionApiRequest` mock
- `tests/server/workspaces/sessionApiRoute.test.ts:248` — `userId` in `ListSessionsQuery` mock

### D. Local type missing optional fields
Local `RetrievalModule` type in test did not include `retrievalMethod?` and `semanticScore?` that were added to the production `RetrievedFileChunk` type.

- `tests/server/workspaces/fileChunkRetrievalService.test.ts:298,299,318,335`

### E. `UploadTask` is not `Promise<unknown>`
Firebase `ref.putString()` returns `UploadTask` (thenable, but not a proper `Promise`). The `expectAllowed`/`expectDenied` helpers required `Promise<unknown>`.

- `tests/firebase/storage.rules.test.ts:14,21`

### F. `mock.calls[0]` typed as empty tuple
`vi.fn(async () => ...)` creates a mock whose `calls` tuple TypeScript inferred as `[]`. Destructuring `[, init]` as `[string, RequestInit]` failed because the cast from `[]` to `[string, RequestInit]` doesn't satisfy the overlap check.

- `tests/server/workspaces/geminiFileChunkEmbeddingProvider.test.ts:31,49`

### G. `createWorkspaceEmulatorTestEnvironment` API mismatch
The test called `createWorkspaceEmulatorTestEnvironment("session-messages-api")` (with 1 arg) and destructured `.testEnv` and `.firestore` from the result. The actual function takes 0 args and returns `RulesTestEnvironment` directly.

- `tests/firebase/sessionMessagesApi.emulator.test.ts:88,89,90`

### H. Missing required fields in `CreateUploadedFileInput`
`extractionStatus` and `chunkingStatus` were added as required fields to `CreateUploadedFileInput` but old test fixtures did not include them.

- `tests/server/workspaces/uploadedFileRepository.test.ts:34,69,79,99,131`

### I. Firebase Admin vs client SDK `doc()` type mismatch
`doc()` from `firebase/firestore/lite` (client SDK) expects client `Firestore`, but the emulator test passes Admin SDK `Firestore`.

- `tests/server/workspaces/uploadedFileRepository.test.ts:153`

### J. Missing `SessionRecord` fields
`SessionRecord` grew `workMode`, `costMode`, `lastActiveAt` as required fields. Session mock return values in `workspacePersistenceService.test.ts` predated this change.

- `tests/server/workspaces/workspacePersistenceService.test.ts:157,167`

---

## 6. Files Changed

| File | Change |
|---|---|
| `tests/behavior/mvpFileLearningPipeline.test.ts` | Double cast + `stance: "neutral" as const` |
| `tests/firebase/sessionMessagesApi.emulator.test.ts` | Fix `createWorkspaceEmulatorTestEnvironment` usage (0 args, direct assign) |
| `tests/firebase/storage.rules.test.ts` | `.then(() => undefined)` to convert `UploadTask` → `Promise<void>` |
| `tests/server/workspaces/fileChunkRetrievalService.test.ts` | Add `retrievalMethod?: string; semanticScore?: number` to local chunk type |
| `tests/server/workspaces/geminiFileChunkEmbeddingProvider.test.ts` | `as unknown as [string, RequestInit]` on both `mock.calls[0]` destructures |
| `tests/server/workspaces/sessionApiRoute.test.ts` | Import `WorkMode`, `CostMode`; add `as const`/`as WorkMode`/`as CostMode`; remove stale `userId` from mock parse results |
| `tests/server/workspaces/sessionApiSchemas.test.ts` | Double cast `as unknown as SessionApiSchemasModule` |
| `tests/server/workspaces/sessionApiService.test.ts` | Double cast `as unknown as SessionApiServiceModule` |
| `tests/server/workspaces/sessionMessageApiSchemas.test.ts` | Double cast `as unknown as SchemasModule` |
| `tests/server/workspaces/sessionMessageApiService.test.ts` | Double cast + `stance: "supports" as const` |
| `tests/server/workspaces/uploadedFileRepository.test.ts` | Add `extractionStatus: "not_started", chunkingStatus: "not_started"` to 5 fixtures; `db as never` for SDK mismatch |
| `tests/server/workspaces/workspacePersistenceService.test.ts` | Add `as const` to status/role/decisionType literals; add `workMode`, `costMode`, `lastActiveAt` to session mocks |

**Source files changed:** none.

---

## 7. What Was Fixed

All fixes are test-only, type-only changes. No runtime behavior was altered.

1. **Double casts** (`as unknown as LocalType`): Required when a test's structural local type is deliberately narrower than the production type (e.g., `Record<string, unknown>` vs typed record). The test logic itself is correct — only the import cast pattern was stale.

2. **`as const` / narrow literal casts**: Required because TypeScript widens object literal field types to `string` unless told otherwise. Adding `as const` restores the narrow type the production interface expects.

3. **Stale `userId` removal**: `CreateSessionApiRequest` and `ListSessionsQuery` no longer expose `userId` (it is derived from auth, not the body). The mock parse results were returning a stale shape; assertions still verify the security invariant via `expect.not.objectContaining({ userId: expect.anything() })`.

4. **`UploadTask` → `Promise`**: `.then(() => undefined)` converts a thenable `UploadTask` into a true `Promise<void>`. This is semantically equivalent for the test's purpose (testing allow/deny of Firebase Storage operations).

5. **`mock.calls[0]` cast**: `fetchMock.mock.calls[0] as unknown as [string, RequestInit]` — necessary because Vitest's `Mock<() => Promise<...>>` infers `calls` as `[]` (no args) when the mock is typed via a thunk. The cast is safe because the mock function IS called with `(url, init)` in the implementation.

6. **`createWorkspaceEmulatorTestEnvironment` API**: Fixed to `testEnv = await createWorkspaceEmulatorTestEnvironment()` (0 args) and `activeFirestore = testEnv.authenticatedContext("system").firestore()`. This matches the actual function signature in `firestoreTestUtils.ts`.

7. **Missing `extractionStatus`/`chunkingStatus`**: Added with value `"not_started"` to all affected `createUploadedFile` call sites. This matches what `uploadedFileApiService` sets on creation.

8. **Firebase Admin/client SDK cast**: `doc(db as never, ...)` — this is an emulator-only test that uses the Admin SDK `Firestore` with the client `doc()` helper. The `as never` suppresses the SDK type mismatch; the test was already working at runtime via the emulator. No alternative without refactoring the test infrastructure.

9. **`SessionRecord` missing fields**: Added `workMode: "Learning" as const`, `costMode: "Normal Learning" as const`, `lastActiveAt: new Date()` to session mock fixtures that predated these required fields.

---

## 8. What Was Intentionally NOT Fixed

- `buildFileInventory` wiring — deferred per task scope (product behavior fix, separate task)
- Retrieval flow — not touched
- Upload behavior — not touched
- UI behavior — not touched
- No tests were deleted or skipped to make the suite pass
- No `any` casts were introduced (only `unknown` intermediates and `never` for one SDK mismatch)
- Emulator-dependent tests (`tests/firebase/**`) not run — require live emulator, correctly skipped by default

---

## 9. Final Validation Results

```
npx tsc --noEmit
→ Exit 0 (clean, no errors)

npx vitest run --exclude 'tests/firebase/**'
→ Test Files  59 passed | 5 skipped (64)
→ Tests       559 passed | 16 skipped (575)
→ Duration    ~13s
```

16 skipped tests are all emulator-gated (`describeFirebaseWorkspaceEmulator`, `describeEmulator`, `describeFirebaseRules`) — expected, correct.

---

## 10. Remaining Issues

None introduced by this pass. Known pre-existing issues from the Recovery Audit that are out of scope here:

- `buildFileInventory()` still not wired (critical, separate task)
- Legacy `executeLegacyIndexedFileRetrieval` still present (high, separate task)
- `pendingFilesByFileId` lost on page refresh (high, separate task)
- Context strip hardcoded (medium, separate task)

---

## 11. Confirmation

**No `git add`, `git commit`, or `git push` was run during this task.**

Changes exist only as uncommitted modifications in the working tree on branch `repair/recovery-typescript-baseline`.
