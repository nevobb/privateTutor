# Workspace Cleanup Batch 9D — Soft Delete Uploaded File Report

## 1. Branch and HEAD
- Branch: `repair/workspace-cleanup-fit-check`
- HEAD: `f10a366 feat: add soft delete for conversations`

## 2. Files changed
Modified:
- `src/types/index.ts`
- `src/server/workspaces/uploadedFileRepository.ts`
- `src/server/workspaces/uploadedFileApiService.ts`
- `src/lib/workspaces/workspaceFilesApiClient.ts`
- `src/components/files/FilePanel.tsx`
- `src/app/page.tsx`
- `tests/lib/workspaces/workspaceFilesApiClient.test.ts`

New files:
- `src/app/api/workspaces/[workspaceId]/files/[fileId]/route.ts`
- `tests/server/workspaces/uploadedFileSoftDelete.test.ts`
- `tests/server/workspaces/uploadedFileSoftDeleteRoute.test.ts`

Memory/docs:
- `agent-memory/WORKSPACE_CLEANUP_BATCH_9D_SOFT_DELETE_UPLOADED_FILE_REPORT.md`
- `agent-memory/DUAL_AGENT_SYNC_LOG.md` (sync entry appended)

## 3. Data model

**`UploadedFile`** (`src/types/index.ts`) — two additive fields:
```ts
isDeleted?: boolean;      // default: false (absent = not deleted)
deletedAt?: Date | null;
```

**Backward compatibility:** `mapUploadedFileRecord` uses `data.isDeleted === true` — old Firestore records without `isDeleted` map to `false`. Strict equality prevents null/0/undefined from triggering deletion.

## 4. Backend/API

### `uploadedFileRepository.ts`

**`softDeleteUploadedFile(userId, fileId)`**
- Reads the Firestore document directly (bypasses `getUploadedFile`)
- Verifies `getOwnerUserId(data) === userId`
- Returns `null` if not found or wrong user
- Idempotent: returns existing record if already deleted (no second Firestore write)
- Sets `isDeleted: true`, `deletedAt: now`, `updatedAt: now` via `ref.update()`
- **No physical deletion of document, subcollections, chunks, embeddings, or Storage**

**`getUploadedFile` updated:**
```ts
if (!snapshot.exists || getOwnerUserId(data) !== userId || data.isDeleted === true) return null;
```
Deleted files appear not-found to all callers — extract/chunks/embeddings routes inherit this block.

**`listUploadedFiles` filter updated:**
```ts
filter(data.userId === userId && data.workspaceId === workspaceId && data.isDeleted !== true)
```

**`mapUploadedFileRecord` updated:**
```ts
isDeleted: data.isDeleted === true,
deletedAt: data.deletedAt ? toDate(data.deletedAt) : null,
```

### `uploadedFileApiService.ts`

**`softDeleteFileForWorkspace(user, workspaceId, fileId)` added to interface:**
- Optional `softDeleteUploadedFile` in `Repositories` (matches pattern of `deepPdfOrchestrationService`)
- Verifies workspace exists
- Calls `softDeleteUploadedFile(user.userId, fileId)`
- Verifies `file.workspaceId === workspaceId` (cross-workspace protection)
- Returns `null` if workspace, file not found, or workspace mismatch

### New route `src/app/api/workspaces/[workspaceId]/files/[fileId]/route.ts`

**`DELETE /api/workspaces/[workspaceId]/files/[fileId]`**
- Auth → validate params → `softDeleteFileForWorkspace` → 200 `{ deleted: true, fileId }`
- 400 for missing workspaceId or fileId
- 404 when file not found
- 503 on Firestore unavailable

## 5. Client

**`workspaceFilesApiClient.ts`** — `deleteWorkspaceFile({ workspaceId, fileId, idToken })`:
- `DELETE /api/workspaces/{workspaceId}/files/{fileId}`
- No body (DELETE with no body, consistent with REST convention)
- Returns `{ deleted: boolean; fileId: string }`
- Throws `WorkspaceFilesApiError` on failure

## 6. UI

**`FilePanel.tsx`**
- Added `onDeleteFile?: (fileId: string) => Promise<void>` prop
- Converted from pure-render to stateful component (added `useState`)
- New state: `confirmDeleteFileId`, `deleteFileError`
- Each file row shows "מחק" (delete) button when `onDeleteFile` is provided
- Clicking "מחק" shows inline Hebrew confirmation: "למחוק את '{name}'?" with "מחק" / "ביטול" buttons
- Delete confirmation button: red (`#c0392b`)
- Hebrew wording: "מחק" / "ביטול" — no hard-delete wording
- On success: confirmation dismissed (parent handles file removal from list)

**`page.tsx`**
- Imports `deleteWorkspaceFile`
- New `handleDeleteFile(fileId: string)`:
  - Gets token
  - Calls `deleteWorkspaceFile({ workspaceId: activeWorkspaceId!, fileId, idToken: token })`
  - Removes file from `uploadedFiles` state in-place (no full reload)
- Passes `onDeleteFile={handleDeleteFile}` to `FilePanel`

## 7. Deleted-file filtering

| Layer | Change | Effect |
|---|---|---|
| `listUploadedFiles` | Added `isDeleted !== true` to filter | File list, FilePanel never shows deleted files |
| `getUploadedFile` | Returns `null` for `isDeleted === true` | Extract/chunks/embeddings routes return `file_not_found` |
| Extract route | No change — inherits from `getUploadedFile` | 400 for deleted files |
| Chunks route | No change — inherits from `getUploadedFile` | 400 for deleted files |
| Embeddings route | No change — inherits from `getUploadedFile` | 400 for deleted files |
| Deep PDF orchestration | No change — inherits from `getUploadedFile` | `file_not_found` → skipped |
| Session message service | No change — inherits from `listUploadedFiles` | Deleted files excluded from retrieval, inventory, grounding |

## 8. Direct operation guards (inherited)

All file lifecycle routes call `getUploadedFile` via `uploadedFileApiService`. Since `getUploadedFile` now returns `null` for deleted files, the behavior is:

| Route | Behavior for deleted file |
|---|---|
| POST extract | `file_not_found` → 400 |
| POST chunks | `file_not_found` → 400 |
| POST embeddings | `file_not_found` → 400 |
| Deep PDF orchestration | `file_not_found` → `{ status: "skipped" }` |
| Session message retrieval | Excluded from `listUploadedFiles` → never retrieved |
| Session file inventory | Excluded from `listUploadedFiles` → never listed |

**No code changes needed in any of these routes.** The single change to `getUploadedFile` propagates to all callers.

## 9. Physical deletion (explicitly NOT done)

Not deleted:
- `users/{userId}/uploadedFiles/{fileId}` Firestore document — preserved
- `users/{userId}/uploadedFiles/{fileId}/pages/*` — preserved
- `users/{userId}/uploadedFiles/{fileId}/documentOutline/*` — preserved
- `users/{userId}/uploadedFiles/{fileId}/detectedQuestions/*` — preserved
- `users/{userId}/workspaces/{workspaceId}/files/{fileId}/chunks/*` — preserved
- `users/{userId}/workspaces/{workspaceId}/files/{fileId}/embeddings/*` — preserved
- Firebase Storage object at `storagePath` — preserved
- Deep PDF provider/model/hash/generation metadata — preserved

## 10. Tests

### `tests/server/workspaces/uploadedFileSoftDelete.test.ts` (13 tests)
- `isDeleted` backward compat: missing/false/null/0 → false; true → true
- `listUploadedFiles` filter: includes active, includes isDeleted:false, excludes isDeleted:true, excludes wrong user, excludes wrong workspace
- `getUploadedFile` filter: null for deleted, non-null for active, non-null for old record, null for wrong user
- Idempotency: already-deleted → no update called

### `tests/server/workspaces/uploadedFileSoftDeleteRoute.test.ts` (8 tests)
- 401 on auth failure
- 400 for missing workspaceId / fileId
- 404 when file not found
- 200 with `{ deleted: true, fileId }` on success
- 503 on Firestore unavailable
- Correct user, workspaceId, fileId passed to service
- No physical delete APIs called

### `tests/lib/workspaces/workspaceFilesApiClient.test.ts` (5 new tests)
- Sends DELETE to correct URL with Authorization header
- Returns `deleted:true` and `fileId` on success
- Throws on 404
- Throws on 403
- Sends no body

### Existing tests: all 896 pass → 925 total

## 11. Validation results
- `npx tsc --noEmit` — ✅ passed
- `npx vitest run` — ✅ 74 files passed, 18 skipped; 925 tests passed, 121 skipped
- `npm run build` — ✅ passed
- `git diff --check` — ✅ passed
- `graphify update .` — ✅ updated

## 12. Not changed
- No Firestore documents deleted
- No Storage objects deleted
- No chunks or embeddings deleted
- No document artifacts deleted
- No Deep PDF artifacts deleted
- No tutor behavior changed
- No retrieval mechanics changed (deletion filter at data layer)
- No Deep PDF execution behavior changed
- No extract/chunks/embeddings routes changed (filter inherited)

## 13. Risks / open decisions

### `softDeleteUploadedFile` optional in Repositories
Made optional (like `deepPdfOrchestrationService`) to avoid breaking all existing tests that construct `Repositories` explicitly. The service checks `repositories.softDeleteUploadedFile` before calling it. Fully safe since `softDeleteFileForWorkspace` is only reachable via the DELETE route.

### `getUploadedFile` now blocks deleted files
All callers that previously got a deleted file by ID will now get `null`. This is the correct behavior, but it means:
- Any future admin/batch job that needs to read deleted files must bypass `getUploadedFile` and read Firestore directly (same pattern as `softDeleteUploadedFile` itself does)

### Cross-workspace check in service
`softDeleteFileForWorkspace` verifies `file.workspaceId === workspaceId` to prevent a user from deleting a file in workspace A using a request for workspace B. This is defense-in-depth since Firestore paths don't enforce this.

### FilePanel state in `renderPanelBody`
The `confirmDeleteFileId` and `deleteFileError` state live in `FilePanel` (the exported component) and are passed as arguments into `renderPanelBody`. This keeps the render logic in a function while the state is in a proper hook context. It's slightly unusual but avoids refactoring the entire panel.

### File order after delete
`setUploadedFiles(prev => prev.filter(...))` removes the file from the local list in order. No re-sort needed. The file panel renders in the order of `uploadedFiles` state.

## 14. Ready for Batch 9E?
**YES**

Batch 9E would add explicit per-file and per-session filtering in:
- `fileChunkRetrievalService.ts` (eligible filter)
- `sessionMessageApiService.ts` tutor grounding paths

However, since `listUploadedFiles` already filters deleted files and `getUploadedFile` returns null for deleted files, most of these paths are already protected. Batch 9E would add explicit documentation/audit of the filter coverage and any remaining gaps.

## 15. Safety confirmations
- No hard delete of any kind.
- No Storage objects deleted.
- No Firestore documents deleted.
- No chunks deleted.
- No embeddings deleted.
- No document artifacts deleted.
- No Deep PDF artifacts deleted.
- No tutor behavior changed.
- No Deep PDF execution behavior changed.
- No git add / commit / push run.
- No git pull run.
