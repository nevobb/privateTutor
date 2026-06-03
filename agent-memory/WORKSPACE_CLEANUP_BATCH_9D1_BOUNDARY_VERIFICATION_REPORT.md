# Workspace Cleanup Batch 9D.1 — Boundary Verification Report

## Branch and HEAD
- Branch: `repair/workspace-cleanup-fit-check`
- HEAD: `f10a366 feat: add soft delete for conversations` (Batch 9D is uncommitted)

## Bug found and fixed

**Bug:** `softDeleteFileForWorkspace` in `uploadedFileApiService.ts` called `softDeleteUploadedFile` BEFORE checking whether the file belongs to the requested `workspaceId`. This meant:

```
// WRONG (before fix):
const file = await repositories.softDeleteUploadedFile(userId, fileId);  // ← deletes first
if (file.workspaceId !== workspaceId) return null;  // ← checks AFTER deletion
```

A user who knew another user's fileId could soft-delete it by using any valid workspaceId that they own.

**Fix:** Read the file via `getUploadedFile` BEFORE calling `softDeleteUploadedFile`:

```ts
// CORRECT (after fix):
const existingFile = await repositories.getUploadedFile(user.userId, fileId);
if (!existingFile) return null;
if (existingFile.workspaceId !== workspaceId) return null;  // ← check BEFORE deletion
return repositories.softDeleteUploadedFile(user.userId, fileId);
```

`getUploadedFile` already verifies `userId` ownership. The workspace check adds the second layer. The file is only soft-deleted if BOTH checks pass.

**Order of checks in the fixed service:**
1. Workspace exists and belongs to user → else null (no file read)
2. File exists and belongs to user (`getUploadedFile` ownership check) → else null (no deletion)
3. File's `workspaceId` matches route's `workspaceId` → else null (no deletion)
4. All checks pass → call `softDeleteUploadedFile`

## Workspace boundary assessment

**FIXED — boundary is now correct.**

| Scenario | Before fix | After fix |
|---|---|---|
| Correct user + correct workspaceId | ✓ deleted | ✓ deleted |
| Correct user + wrong workspaceId | ✗ deleted (bug) | ✓ not deleted, returns null |
| Wrong user's file | ✓ null (repo blocks) | ✓ null (repo blocks) |
| Workspace not found | ✓ null | ✓ null |
| File not found | ✓ null | ✓ null |

## Deleted-file filter semantics

### `listUploadedFiles` filter

Filter used: `data.isDeleted !== true`

| Value | Included? | Correct? |
|---|---|---|
| `isDeleted: undefined` (missing) | ✓ included | ✓ — old records must be listed |
| `isDeleted: false` | ✓ included | ✓ |
| `isDeleted: null` | ✓ included | ✓ — tolerant of null |
| `isDeleted: true` | ✗ excluded | ✓ |

`!== true` is correct and intentionally broader than `=== false`. Old Firestore records without the field map safely.

### `getUploadedFile` filter

Filter used: `data.isDeleted === true → return null`

| Value | Returns null? | Correct? |
|---|---|---|
| `isDeleted: true` | ✓ null | ✓ |
| `isDeleted: false` | ✗ returns file | ✓ |
| `isDeleted: null` | ✗ returns file | ✓ — tolerant |
| `isDeleted: undefined` (missing) | ✗ returns file | ✓ — backward compat |

`=== true` is strict. Only `true` blocks access. null/false/undefined/0 do not.

## Fixes made

One code change in `src/server/workspaces/uploadedFileApiService.ts`:
- `softDeleteFileForWorkspace` now reads file via `getUploadedFile` BEFORE calling `softDeleteUploadedFile`
- Returns `null` without deletion if `existingFile.workspaceId !== workspaceId`

## Tests

### `tests/server/workspaces/uploadedFileSoftDeleteBoundary.test.ts` (new, 24 tests)

**Workspace boundary (6 tests):**
- Deletes file when workspaceId matches ✓
- Returns null when workspace not found — no deletion ✓
- Returns null when file not found — no deletion ✓
- Does NOT delete when file.workspaceId mismatches route workspaceId ✓
- Does NOT modify file via cross-workspace attack ✓
- Checks workspace before reading file ✓

**listUploadedFiles filter (8 tests):**
- Includes missing isDeleted (old records) ✓
- Includes isDeleted: false ✓
- Includes isDeleted: null ✓
- Includes isDeleted: undefined ✓
- Excludes isDeleted: true ✓
- Excludes wrong user ✓
- Excludes wrong workspace ✓
- `!== true` handles null and undefined (not just false) ✓

**getUploadedFile filter (5 tests):**
- Returns null for isDeleted: true ✓
- Returns non-null for isDeleted: false ✓
- Returns non-null for missing isDeleted ✓
- Returns null for wrong user ✓
- Strict `=== true`: null/false/undefined/0 do NOT block ✓

### `tests/server/workspaces/uploadedFileSoftDeleteRoute.test.ts` (3 new tests added to existing 8)

- Route returns 404 when service returns null (workspace mismatch) ✓
- Route passes workspaceId to service so boundary can be enforced ✓
- File not modified when workspace mismatch, route returns 404 ✓

### All previous 9D tests: still pass

## Validation results
- `npx tsc --noEmit` — ✅ passed
- `npx vitest run` — ✅ 75 files passed, 18 skipped; 947 tests passed, 121 skipped
- `npm run build` — ✅ passed
- `git diff --check` — ✅ passed
- `graphify update .` — ✅ updated

## Ready for Batch 9D commit

**YES**

The workspace boundary is now correct:
1. Workspace existence verified first
2. File read via `getUploadedFile` (userId ownership + not-deleted check)
3. File's workspaceId verified against route workspaceId
4. Only then: soft delete called

The filter semantics (`!== true` for list, `=== true` for get) are correct and handle all edge cases including backward-compatible old records.

## Safety confirmations
- No hard delete.
- No Storage objects deleted.
- No Firestore documents deleted.
- No chunks, embeddings, or artifacts deleted.
- No tutor behavior changed.
- No Deep PDF behavior changed.
- No git add / commit / push run.
- No git pull run.
