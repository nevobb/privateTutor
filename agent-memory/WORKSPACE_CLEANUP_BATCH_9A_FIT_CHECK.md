# Workspace Cleanup Batch 9A — Fit Check

## 1. Branch name and HEAD commit
- Branch: `repair/workspace-cleanup-fit-check`
- HEAD: `e2b96fe fix: extend session message timeout for grounded responses`

## 2. Current working tree status
Clean. No modified source files. Untracked: batch reports from 8C/8D/8E, and the Batch 8D/8C server-side files (deepPdfOrchestrationService, firebaseStoragePdfBytesLoader, tests). All are expected and additive.

---

## 3. Current session/conversation data model

**Firestore path:** `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}`

**`SessionRecord` fields** (`src/server/workspaces/workspaceTypes.ts:29`):
```ts
id: string
userId: string
workspaceId: string
title: string               ← already present, editable
workMode: WorkMode
costMode: CostMode
activeTopic?: string
status: "active" | "closed" | "archived"   ← already has status enum
startedAt: Date
lastActiveAt: Date
updatedAt: Date
messageCount: number
lastMessageAt?: Date
summary?: string
```

**Key findings:**
- `title` already exists. Rename just needs a PATCH endpoint to update it.
- `status` already exists with `"active" | "closed" | "archived"`. Need to add `"deleted"` to this union for soft delete.
- No `isDeleted: boolean` or `deletedAt: Date` field — must add.
- `listSessions` does NOT filter by status — returns all sessions for the workspace/user. A deleted session will appear in the sidebar.

---

## 4. Current uploaded file data model

**Firestore path:** `users/{userId}/uploadedFiles/{fileId}`

**`UploadedFile` fields** (`src/types/index.ts:118`):
- No `isDeleted`, `deletedAt`, or `deletedReason` fields. These must be added.
- `storagePath` is stored — needed for future hard-delete of Storage object.
- `workspaceId` field links file to a workspace.

**Associated data stored elsewhere:**
| Data | Firestore path |
|---|---|
| Chunks | `users/{userId}/workspaces/{workspaceId}/files/{fileId}/chunks/{chunkId}` (implied by `FileChunkRecord`) |
| Embeddings | `users/{userId}/workspaces/{workspaceId}/files/{fileId}/embeddings/{chunkId}` |
| Pages | `users/{userId}/uploadedFiles/{fileId}/pages/{pageId}` |
| DocumentOutline | `users/{userId}/uploadedFiles/{fileId}/documentOutline/v1` |
| DetectedQuestions | `users/{userId}/uploadedFiles/{fileId}/detectedQuestions/{questionId}` |

---

## 5. Existing APIs and client helpers

### Sessions
| Surface | File | Current capability |
|---|---|---|
| POST /sessions | `src/app/api/sessions/route.ts` | Create only |
| GET /sessions | `src/app/api/sessions/route.ts` | List all (no filter) |
| POST /sessions/{id}/messages | `src/app/api/sessions/{sessionId}/messages/route.ts` | Send message |
| GET /sessions/{id}/messages | same | Load messages |
| `fetchSessions` | `src/lib/sessions/sessionApiClient.ts` | Client: list sessions |
| `createSession` | same | Client: create session |
| `sessionApiService.listSessionsForUser` | `src/server/workspaces/sessionApiService.ts` | Service: list, no filter |
| `sessionApiService.createSessionForUser` | same | Service: create |
| `sessionRepository.listSessions` | `src/server/workspaces/sessionRepository.ts:75` | DB: list, no status filter |
| `sessionRepository.getSession` | same | DB: get by id, no status filter |

**Missing:** No rename endpoint. No soft-delete endpoint. No `PATCH /sessions/{id}` or `DELETE /sessions/{id}`.

### Uploaded files
| Surface | File | Current capability |
|---|---|---|
| GET /workspaces/{id}/files | `files/route.ts` | List all (no filter) |
| POST /workspaces/{id}/files | same | Create metadata |
| POST .../extract | extract/route.ts | Extract text |
| POST .../chunks | chunks/route.ts | Chunk text |
| POST .../embeddings | embeddings/route.ts | Embed chunks |
| `fetchWorkspaceFiles` | `workspaceFilesApiClient.ts` | Client: list, no filter |
| `uploadedFileApiService.listFilesForWorkspace` | `uploadedFileApiService.ts` | Service: list, no filter |
| `uploadedFileRepository.listUploadedFiles` | `uploadedFileRepository.ts:94` | DB: filter by userId+workspaceId only |

**Missing:** No soft-delete endpoint. No `DELETE /workspaces/{id}/files/{fileId}` or `PATCH` for deletion.

---

## 6. Existing UI touchpoints

### Conversation sidebar (`src/components/workspaces/WorkspaceSelector.tsx`)
- Renders session list as nav items
- `<NavItem>` buttons — no context menu, no rename, no delete
- `+ New conversation` button at bottom
- No kebab menu or right-click context

### File panel (`src/components/files/FilePanel.tsx`)
- Lists uploaded files with processing status
- `Continue processing` / `Retry processing` buttons per file
- No delete button, no rename, no context menu

### Session message area (`src/components/tutor/TutorConversation.tsx`)
- No session management controls

### `page.tsx`
- `handleCreateWorkspace` — creates workspace
- `handleCreateSession` — creates session
- `handleFileSelected` — uploads file
- `handleContinueProcessing` — resumes file processing
- No delete handlers

---

## 7. Required soft-delete fields

### Sessions
Add to `SessionRecord` and `CreateSessionInput`:
```ts
isDeleted: boolean          // default: false
deletedAt?: Date | null     // null unless deleted
```
Also extend `SessionStatus` union: `"active" | "closed" | "archived" | "deleted"`

### Uploaded files
Add to `UploadedFile` and `CreateUploadedFileInput`:
```ts
isDeleted: boolean          // default: false
deletedAt?: Date | null     // null unless deleted
```

**Backward compat:** Old Firestore records without `isDeleted` map safely to `false` (same as `??` fallback used elsewhere in the project).

---

## 8. Required rename-session fields/behavior

`title` already exists on `SessionRecord`. The work is:
1. Add `PATCH /api/sessions/{sessionId}` route accepting `{ title: string }` in body
2. Add `updateSession(userId, workspaceId, sessionId, { title })` to `sessionRepository.ts`
3. Add `renameSessionForUser(user, sessionId, { title, workspaceId })` to `sessionApiService.ts`
4. Add `renameSession(token, sessionId, input)` to `sessionApiClient.ts`
5. Wire into `WorkspaceSelector.tsx` — inline edit on nav item or modal

**No schema migration needed** — title field already in Firestore records.

---

## 9. Every place deleted sessions must be filtered

| Location | File | Current filter | Must add |
|---|---|---|---|
| List sessions API | `sessionApiService.ts:47` | None | `isDeleted !== true` |
| Session repository list | `sessionRepository.ts:75` | userId only | `isDeleted !== true` |
| Open session guard | `sessionRepository.ts:90` | userId only | return null if isDeleted |
| Load messages route | `messages/route.ts:85` | uses `getSession` | inherits from getSession guard |
| Session message service | `sessionMessageApiService.ts:147` | uses `getSession` | inherits from getSession guard |
| `page.tsx` session state | client-side | receives API list | filtered by API already |
| `WorkspaceSelector` sidebar | client-side | renders all in state | filtered by API already |

**Priority:** `listSessions` and `getSession` in the repository — everything else inherits from those two.

---

## 10. Every place deleted files must be filtered

| Location | File | Current filter | Must add |
|---|---|---|---|
| List files API | `uploadedFileApiService.ts:listFilesForWorkspace` | workspaceId match | `isDeleted !== true` |
| File repository list | `uploadedFileRepository.ts:94` | userId + workspaceId | `isDeleted !== true` |
| File access status (tutor) | `sessionMessageApiService.ts:193-194` | extractionStatus+chunkingStatus | `isDeleted !== true` |
| File inventory shortcut | `sessionMessageApiService.ts:229-231` | extractionStatus+chunkingStatus | `isDeleted !== true` |
| Retrieval eligible files | `fileChunkRetrievalService.ts:85` | extractionStatus+chunkingStatus+chunkCount | `isDeleted !== true` |
| Indexed-files retrieval | `sessionMessageApiService.ts:739-740` | indexingStatus === "indexed" | `isDeleted !== true` |
| Artifact grounding file filter | `sessionMessageApiService.ts:987-989` | understandingStatus === "completed" | `isDeleted !== true` |
| File panel (client) | `page.tsx:setUploadedFiles` / `FilePanel.tsx` | no filter | filtered by API list already |
| File count in toolbar | `TutorConversation.tsx:uploadedFileCount` | from parent state | filtered by parent state already |
| Deep PDF eligibility | `deepPdfOrchestrationService.ts:153-164` | reads file by id | guard: if isDeleted → skip |
| Text-only understanding | `uploadedFileApiService.ts:runChunkingLifecycleForFile` | already in progress | N/A (lifecycle only) |

**Priority order:**
1. `uploadedFileRepository.listUploadedFiles` — all other filters inherit from here
2. `fileChunkRetrievalService` eligible filter
3. The 4 `listUploadedFiles` call sites in `sessionMessageApiService.ts`
4. `deepPdfOrchestrationService` guard on `isDeleted`

**Single-point fix available:** If `listUploadedFiles` always filters out `isDeleted === true`, all downstream code inherits the filter for free. Only `getUploadedFile` (by id) needs an additional isDeleted check to prevent direct access by id.

---

## 11. Hard delete deferred plan

When eventually implemented, hard delete of an uploaded file requires (in safe order):
1. Mark `isDeleted = true`, `deletedAt = now` (already done in soft delete)
2. Delete Firestore chunks: `users/{userId}/workspaces/{workspaceId}/files/{fileId}/chunks/*`
3. Delete Firestore embeddings: `users/{userId}/workspaces/{workspaceId}/files/{fileId}/embeddings/*`
4. Delete Firestore pages: `users/{userId}/uploadedFiles/{fileId}/pages/*`
5. Delete Firestore documentOutline: `users/{userId}/uploadedFiles/{fileId}/documentOutline/v1`
6. Delete Firestore detectedQuestions: `users/{userId}/uploadedFiles/{fileId}/detectedQuestions/*`
7. Delete Firebase Storage object at `storagePath`
8. Delete `users/{userId}/uploadedFiles/{fileId}` Firestore document itself

For sessions hard delete:
1. Mark `isDeleted = true` (soft delete)
2. Delete all messages: `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}/messages/*`
3. Delete decision log entries if session-scoped
4. Delete session document itself

**Recommendation:** Do not implement hard delete until after soft delete is stable and validated. Hard delete should be a separate batch (9F) and potentially triggered by an admin/cron job rather than a user action, to prevent accidental data loss.

---

## 12. Recommended batch plan

### 9B — Rename conversation
**Scope:** server only + minimal client
- Add `updateSession` to `sessionRepository.ts` (title update)
- Add `renameSessionForUser` to `sessionApiService.ts`
- Add `PATCH /api/sessions/{sessionId}` route
- Add `renameSession` client helper
- Wire into `WorkspaceSelector.tsx` (inline edit on nav item)
- Tests: repository update, route, client helper, UI interaction

### 9C — Soft delete conversation
**Scope:** data model + server + client + filter
- Add `isDeleted: boolean`, `deletedAt?: Date` to `SessionRecord`/types
- Extend `SessionStatus` with `"deleted"` if preferred, OR use `isDeleted` flag (prefer flag: simpler to add, tolerant of missing field in old records)
- Add `deleteSession` to `sessionRepository.ts`
- Add `deleteSessionForUser` to `sessionApiService.ts`
- Add `DELETE /api/sessions/{sessionId}` route
- Filter `listSessions` and `getSession` to exclude `isDeleted`
- Remove from `WorkspaceSelector` sidebar on delete
- Tests: filter behavior, API route, old records without isDeleted still readable

### 9D — Soft delete uploaded file
**Scope:** data model + server + client + filter
- Add `isDeleted: boolean`, `deletedAt?: Date` to `UploadedFile`/types
- Add `deleteUploadedFile` update path to `uploadedFileRepository.ts`
- Add `deleteFileForWorkspace` to `uploadedFileApiService.ts`
- Add `DELETE /api/workspaces/{workspaceId}/files/{fileId}` route
- Add client helper `deleteWorkspaceFile`
- Filter `listUploadedFiles` to exclude `isDeleted`
- Add delete button to `FilePanel.tsx`
- Tests: filter behavior, repository update, API route, file panel

### 9E — Exclude deleted files from retrieval/inventory/grounding
**Scope:** tutor service + retrieval + grounding
- After 9D filter is in `listUploadedFiles`, most places inherit automatically
- Add explicit `isDeleted !== true` guards to `fileChunkRetrievalService.ts:85`
- Add explicit guard in `deepPdfOrchestrationService.ts` `getUploadedFile` path
- Add explicit guard in the 4 `listUploadedFiles` call sites in `sessionMessageApiService.ts` if needed (likely automatic)
- Tests: retrieval with deleted file excluded, inventory with deleted file excluded, grounding with deleted file excluded

### 9F — Hard delete cleanup (future, deferred)
- Background job or admin-triggered
- Follows the safe deletion order documented in section 11
- Not part of user-facing cleanup flow

---

## 13. Risks / open decisions

### Session title is already mutable in Firestore
`title` is stored. PATCH route is the main work. Risk: if two sessions have the same title after rename, sidebar shows duplicates. No uniqueness constraint needed — just allow free rename.

### `SessionStatus` vs `isDeleted` flag
Two equivalent approaches:
- Extend `SessionStatus` union to include `"deleted"` and filter on status
- Add a separate `isDeleted: boolean` field
**Recommendation:** `isDeleted + deletedAt` — mirrors what other apps use, avoids `status` union sprawl, easier to add to old records (default to false when absent), and simpler to query (single boolean field check).

### `listUploadedFiles` full-load + client filter
`uploadedFileRepository.listUploadedFiles` currently fetches ALL files for userId, then filters to workspaceId in memory. Adding `isDeleted` filter in memory is safe and consistent. A Firestore composite index isn't needed for MVP. If file counts grow large, a future optimization can add a Firestore `where("isDeleted", "==", false)` filter before the client-side filter.

### Old Firestore records without `isDeleted`
Existing sessions and files don't have `isDeleted`. Map function must safely default: `isDeleted: data.isDeleted === true` — any missing field maps to false. This is the pattern used throughout the project for optional fields.

### Deep PDF on a deleted file
If a file is deleted mid-processing (after quality gate but before Deep PDF run), the Deep PDF orchestration service reads the file by ID. Must add an `isDeleted` guard in `runDeepPdfUnderstanding` after `getUploadedFile`.

### Message history after session soft delete
Deleted sessions still have messages in Firestore. If `getSession` returns null for deleted sessions (as recommended), any attempt to load messages will also return 404 (the message route calls `getSession` internally). Messages are effectively inaccessible but not deleted. This is correct for soft delete.

### Confirmation modal
Deleting files and conversations should have a confirmation. This is a UI concern for 9C and 9D. Simple confirmation string ("מחק שיחה?", "מחק קובץ?") in modal or inline confirmation.

---

## 14. Validation results
- `npx tsc --noEmit` — ✅ passed (no code changes)
- `npx vitest run` — ✅ 67 files passed, 18 skipped; 833 tests passed, 121 skipped
- `npm run build` — ✅ passed
- `git diff --check` — ✅ passed
- `graphify update .` — ✅ passed

---

## 15. Ready for Batch 9B?
**YES**

Batch 9B (rename conversation) is the smallest, most isolated change. `title` already exists; the only work is a PATCH route + repository update + client helper + minimal UI. No schema migration, no filter changes, no data model additions required.

---

## 16. Confirmation that no code was changed
Confirmed. This is a read-only audit.

## 17. Confirmation that no files/storage records were deleted
Confirmed.

## 18. Confirmation that no git add / commit / push was run
Confirmed:
- No `git add`
- No `git commit`
- No `git push`

## 19. Confirmation that no git pull was run
Confirmed:
- No `git pull`
