# Workspace Cleanup Batch 9C — Soft Delete Conversation Report

## 1. Branch and HEAD
- Branch: `repair/workspace-cleanup-fit-check`
- HEAD: `544b868 feat: add conversation rename support`

## 2. Files changed
Modified:
- `src/server/workspaces/workspaceTypes.ts`
- `src/server/workspaces/sessionRepository.ts`
- `src/server/workspaces/sessionApiSchemas.ts`
- `src/server/workspaces/sessionApiService.ts`
- `src/app/api/sessions/[sessionId]/route.ts`
- `src/lib/sessions/sessionApiTypes.ts`
- `src/lib/sessions/sessionApiClient.ts`
- `src/components/workspaces/WorkspaceSelector.tsx`
- `src/app/page.tsx`
- `tests/lib/sessions/sessionApiClient.test.ts`

New files:
- `tests/server/workspaces/sessionSoftDelete.test.ts`
- `tests/server/workspaces/sessionSoftDeleteSchemas.test.ts`
- `tests/server/workspaces/sessionSoftDeleteApiRoute.test.ts`

Memory/docs:
- `agent-memory/WORKSPACE_CLEANUP_BATCH_9C_SOFT_DELETE_CONVERSATION_REPORT.md`
- `agent-memory/DUAL_AGENT_SYNC_LOG.md` (sync entry appended)

## 3. Data model

**`SessionRecord`** (`workspaceTypes.ts`) — two additive fields:
```ts
isDeleted?: boolean;    // default: false (absent = not deleted)
deletedAt?: Date | null;
```

**Backward compatibility:** `mapSessionRecord` uses `data.isDeleted === true` — old Firestore documents without `isDeleted` map to `false` (not deleted). Strict equality prevents `null`/`undefined` from falsely triggering deletion.

## 4. Backend/API

### `sessionRepository.ts`

**`softDeleteSession(userId, workspaceId, sessionId)`**
- Asserts workspace ownership (reuses `assertWorkspaceOwnership`)
- Verifies `data.userId === userId`
- Returns `null` if not found or wrong user
- Returns existing record if already deleted (idempotent)
- Sets `isDeleted: true`, `deletedAt: now`, `updatedAt: now` via `ref.update()`
- **Does not delete messages, chunks, artifacts, or the Firestore document itself**

**`listSessions` filter updated:**
```ts
filter((d) => data.userId === userId && data.isDeleted !== true)
```
Deleted sessions are excluded from all session lists.

**`getSession` filter updated:**
```ts
if (!snapshot.exists || data.userId !== userId || data.isDeleted === true) return null;
```
Deleted sessions appear not-found to all callers including the message route.

**`mapSessionRecord` updated:**
```ts
isDeleted: data.isDeleted === true,
deletedAt: data.deletedAt ? toDate(data.deletedAt) : null,
```

### `sessionApiSchemas.ts`

**`DeleteSessionApiRequest: { workspaceId: string }`**

**`parseDeleteSessionRequest(body)`:**
- Validates body is object
- Requires non-empty `workspaceId`
- Returns `{ ok: true, input }` or `{ ok: false, error }`

### `sessionApiService.ts`

**`softDeleteSessionForUser(user, sessionId, input)` added to interface + implementation:**
- Resolves trusted userId
- Verifies workspace exists
- Delegates to `softDeleteSession`

### `[sessionId]/route.ts`

**`DELETE /api/sessions/[sessionId]`** handler added alongside existing PATCH:
- Body: `{ workspaceId: string }`
- Auth → parse → service → 200 `{ deleted: true, sessionId }`
- 400 on validation failure
- 404 when session or workspace not found
- 503 on Firestore unavailable

### Message route blocking (inherited)

`sessionMessageApiService.sendMessageForUser` calls `getSession` at line 147. Since `getSession` now returns `null` for deleted sessions, the service throws `"Session not found."` → message route returns 404. **No code change needed in message route.**

## 5. Client

**`sessionApiTypes.ts`** — `DeleteSessionInput: { workspaceId: string }`

**`sessionApiClient.ts`** — `deleteSession(token, sessionId, input)`:
- DELETE `/api/sessions/{sessionId}`
- Body: `{ workspaceId }`
- Returns `{ deleted: boolean; sessionId: string }`
- 401 for empty token, 400 for empty sessionId
- Hebrew error fallback: "מחיקת השיחה נכשלה."

## 6. UI

**`WorkspaceSelector.tsx`**
- New optional prop: `onDeleteSession?: (sessionId: string) => Promise<void>`
- New local state: `confirmDeleteSessionId`, `deleteError`
- Session items with `onDeleteSession` prop show a `✕` button on hover (alongside existing `✎` rename button)
- Clicking `✕` switches item to inline confirmation:
  - Hebrew: 'מחק "{label}"?'
  - Buttons: `מחק` (red) / `ביטול`
  - Error shown inline on failure
  - Cancel restores normal item view
- Confirmation is required — no single-click delete
- Wording says "מחק" (delete/remove) not "hard delete" or any technical language

**`page.tsx`**
- Imports `deleteSession`
- New `handleDeleteSession(sessionId: string)`:
  - Gets token
  - Calls `deleteSession(token, sessionId, { workspaceId: activeWorkspaceId! })`
  - Removes session from `sessionState` in-place (no full reload)
  - Clears `activeSessionId` if the deleted session was active (falls back to `null` → no active session)
- Passes `onDeleteSession={handleDeleteSession}` to `WorkspaceSelector`

## 7. Deleted-session filtering

| Layer | Change | Effect |
|---|---|---|
| `listSessions` in repository | Added `isDeleted !== true` filter | Sidebar never shows deleted sessions |
| `getSession` in repository | Returns `null` for `isDeleted === true` | Direct access by ID blocked |
| Message route (POST) | No change — inherits from `getSession` | Sending to deleted session → 404 |
| Message route (GET) | No change — inherits from `getSession` | Loading deleted session messages → 404 |
| `sessionApiService.listSessionsForUser` | No change — delegates to repository | Automatic filter |
| Client `sessionState` | `handleDeleteSession` removes session | Sidebar updates immediately |

## 8. Active session behavior

When `handleDeleteSession` runs:
1. Removes deleted session from `sessionState.sessions`
2. `setActiveSessionId((prev) => prev !== sessionId ? prev : null)`
   - If deleted session was NOT active → active session unchanged
   - If deleted session WAS active → `activeSessionId = null` → conversation area shows "no active session" prompt
   - No automatic selection of next session (matches existing "create a new session" UX)
3. `TutorConversation` already handles `activeSessionId === null` with a natural prompt to create/select a session

## 9. Tests

### `tests/server/workspaces/sessionSoftDelete.test.ts` (16 tests)
- `isDeleted` backward compat: missing/false/null → not deleted; true → deleted
- `listSessions` filter contract: includes active, includes isDeleted:false, excludes isDeleted:true, excludes wrong user
- `getSession` filter contract: null for deleted, non-null for active, non-null for old record, null for wrong user
- Schema integration: valid body, empty body

### `tests/server/workspaces/sessionSoftDeleteSchemas.test.ts` (5 tests)
- Valid workspaceId → ok
- Missing workspaceId → rejected
- Whitespace-only → rejected
- Null body → rejected
- Array body → rejected

### `tests/server/workspaces/sessionSoftDeleteApiRoute.test.ts` (8 tests)
- 401 on auth failure
- 400 for missing sessionId
- 400 for invalid JSON body
- 400 when schema validation fails
- 404 when session not found
- 404 when workspace not found
- 200 with `{ deleted: true, sessionId }` on success
- 503 on Firestore unavailable
- Correct user + sessionId passed to service

### `tests/lib/sessions/sessionApiClient.test.ts` (7 new tests)
- Sends DELETE to correct URL
- Sends workspaceId in body
- Returns `deleted:true` on success
- 401 for empty token
- 400 for empty sessionId
- 404 on 404 response
- 503 on timeout

### Existing tests: all 860 pass → 896 total

## 10. Validation results
- `npx tsc --noEmit` — ✅ passed
- `npx vitest run` — ✅ 72 files passed, 18 skipped; 896 tests passed, 121 skipped
- `npm run build` — ✅ passed
- `git diff --check` — ✅ passed
- `graphify update .` — ✅ updated

## 11. Not changed
- No messages physically deleted
- No Firestore session document deleted
- No uploaded files changed
- No artifacts changed
- No retrieval changed
- No tutor behavior changed
- No Deep PDF behavior changed
- No hard delete implemented
- No bulk delete implemented

## 12. Risks / open decisions

### `activeSessionId` falls back to null (not next session)
When the active session is deleted, `activeSessionId` becomes `null` rather than auto-selecting the next session. The UI shows "no active session". This is the safe choice — auto-selecting could open a session the user doesn't want. A future improvement can select the first remaining session.

### Idempotent soft delete
`softDeleteSession` returns the existing record without error if already deleted. This prevents 500 errors from double-clicks, but the service layer could also be designed to return a specific status. Current behavior matches the "safe and quiet" principle.

### Messages remain readable via Firestore directly
Soft delete only hides the session from the app. Messages are still in Firestore. This is intentional for Batch 9C (data preservation). Hard delete of messages is part of future Batch 9F.

### `ref.update()` fails if document doesn't exist
If `assertWorkspaceOwnership` passes but the session document disappears between the check and the `update()` call, `ref.update()` will throw. This is caught by the outer try/catch in `updateSession` and `softDeleteSession`. Not a practical risk.

### `WorkspaceSelector` confirmation UI is Hebrew-only
The confirm prompt uses Hebrew: "מחק..." and "ביטול". This is consistent with the rest of the app which is Hebrew-first.

## 13. Ready for Batch 9D?
**YES**

Batch 9D (soft delete uploaded file) follows the same pattern:
- Add `isDeleted`, `deletedAt` to `UploadedFile`/`UploadedFileRecord`
- Add `softDeleteUploadedFile` to `uploadedFileRepository.ts`
- Add `deleteFileForWorkspace` to `uploadedFileApiService.ts`
- Add `DELETE /api/workspaces/{workspaceId}/files/{fileId}` route
- Filter `listUploadedFiles` to exclude `isDeleted`
- Add delete button to `FilePanel.tsx`

## 14. Safety confirmations
- No uploaded file deletion implemented.
- No hard delete of any kind.
- Messages not physically deleted.
- Firestore records not deleted.
- Storage objects not deleted.
- Retrieval not changed.
- Tutor behavior not changed.
- Deep PDF behavior not changed.
- No git add / commit / push run.
- No git pull run.
