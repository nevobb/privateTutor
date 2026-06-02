# File Learning Pipeline Trace Report

## 1. Branch

- Branch: `audit/post-repair-recovery-audit`

## 2. Working tree

- `git status --short` was clean before this report was written.
- After writing this report, the expected working tree change is this report file only.

## 3. Scope and constraints

- This was a diagnostic-only audit.
- No source code was edited.
- No fixes were implemented.
- No refactors were performed.
- No `git add`, `git commit`, `git push`, or `git pull` were run.

## 4. Graphify commands used

- `graphify query "file learning workflow upload extract chunk embed retrieval inventory tutor"`
- `graphify query "TutorConversation send message API route session messages tutor route"`
- `graphify query "requestClassifier file_content_inventory Hebrew uploaded files"`
- `graphify query "sessionMessageApiService buildFileInventory listUploadedFiles listFileChunks"`
- `graphify query "FilePanel ready status uploaded files processing chunks"`
- `graphify query "api tutor route provider model call session message route"`

## 5. Full pipeline map

### Upload and processing pipeline

1. `src/app/page.tsx` handles file selection and workspace refresh.
2. `src/lib/firebase/storageUploadClient.ts` uploads file bytes to storage.
3. `src/lib/workspaces/workspaceFilesApiClient.ts` creates workspace file metadata through `/api/workspaces/[workspaceId]/files`.
4. `src/app/api/workspaces/[workspaceId]/files/route.ts` calls `uploadedFileApiService.createFileForWorkspace(...)`.
5. `src/server/workspaces/uploadedFileApiService.ts` creates the uploaded file record and initializes processing state.
6. `src/app/page.tsx` continues processing through extract, chunk, and embedding calls.
7. `src/app/api/workspaces/[workspaceId]/files/[fileId]/extract/route.ts` runs extraction.
8. `src/app/api/workspaces/[workspaceId]/files/[fileId]/chunks/route.ts` runs chunking.
9. `src/app/api/workspaces/[workspaceId]/files/[fileId]/embeddings/route.ts` runs embedding.

### File visibility pipeline

1. `src/app/page.tsx` reloads workspace files with `fetchWorkspaceFiles(...)`.
2. The same `activeWorkspaceId` is passed into `FilePanel` and `TutorConversation`.
3. `src/components/files/FilePanel.tsx` renders processing state and ready state.

### Chat and answer pipeline

1. `src/components/tutor/TutorConversation.tsx` sends user chat through `sendSessionMessage(...)`.
2. `src/lib/sessions/sessionMessagesApiClient.ts` posts to `/api/sessions/[sessionId]/messages`.
3. `src/app/api/sessions/[sessionId]/messages/route.ts` validates input and calls `sessionMessageApiService.sendMessageForUser(...)`.
4. `src/server/workspaces/sessionMessageApiService.ts` classifies the request first.
5. Only `file_access_status` and `file_content_inventory` intents bypass the general tutor path and inspect files directly.
6. If classification falls through to `general_tutor_question`, the service calls the model/provider path before any inventory response logic.

## 6. Exact route used by chat

- Verified active chat route: `/api/sessions/[sessionId]/messages`
- Verified not used by the current UI chat flow: `/api/tutor`

## 7. Exact smoke-test request classification

Exact question tested:

- `איזה קבצים העליתי לסביבת העבודה הזאת ומה יש בהם?`

Observed classifier result:

```json
{
  "intent": "general_tutor_question",
  "shouldUseRetrieval": false,
  "shouldUseFileInventory": false,
  "shouldAnswerFromSystemState": false,
  "needsClarification": false,
  "reason": "no file-specific intent detected; treat as a general academic question"
}
```

## 8. Whether `sessionMessageApiService` is actually reached

- Yes.
- The UI route and server handler both lead directly into `sessionMessageApiService.sendMessageForUser(...)`.

## 9. Whether `buildFileInventory(...)` is reachable from user flow

- Yes in general.
- No for the exact failing smoke-test phrase above.
- Reason: the inventory branch is gated by classification, and this exact phrase is misclassified before `buildFileInventory(...)` is reached.

## 10. Whether `listUploadedFiles(...)` returns a ready file

- For the exact failure trace: not reached, so not observed at runtime in that path.
- Static pipeline evidence suggests the same `activeWorkspaceId` drives both file listing and chat requests, so workspace mismatch is not the primary suspect.

## 11. Whether FilePanel ready state matches backend inventory readiness

- Yes, and `FilePanel` is stricter.
- `FilePanel` “ready for learning” requires extraction, chunking, and embedding completion.
- Inventory response logic only needs extraction and chunking to be complete enough to summarize contents.
- Therefore, if `FilePanel` shows ready, backend inventory prerequisites should already be satisfied.

## 12. Whether `listFileChunks(...)` returns chunks

- For the exact failed request path: not reached, so not directly observed in runtime trace.
- Architecture strongly suggests chunks should exist if the file truly appears ready in `FilePanel`, but this was not the failure point that blocked the smoke-test phrase.

## 13. Whether model/provider was called

- Yes.
- A direct service-level diagnostic using the exact Hebrew question showed the service called the general tutor response path and did not call file inventory methods first.
- Observed call trace: `getMockTutorResponse`

## 14. Evidence table

| Checkpoint | Expected behavior | Observed behavior | Evidence source | Status | Notes |
|---|---|---|---|---|---|
| Upload metadata creation | File record created for workspace | Confirmed by route and service trace | `src/app/api/workspaces/[workspaceId]/files/route.ts`, `src/server/workspaces/uploadedFileApiService.ts` | Verified | Not the failing stage |
| Refresh-safe continuation | Processing can continue after refresh | Previously repaired and documented | `agent-memory/FILE_PROCESSING_PERSISTENCE_REPAIR_REPORT.md` plus current code trace | Verified | Relevant background only |
| Shared workspace context | File UI and chat use same workspace | Confirmed same `activeWorkspaceId` is passed through | `src/app/page.tsx`, `src/components/tutor/TutorConversation.tsx` | Verified | Reduces workspace mismatch likelihood |
| Chat route selection | UI should hit session messages route | UI uses `/api/sessions/[sessionId]/messages` | `src/components/tutor/TutorConversation.tsx`, `src/lib/sessions/sessionMessagesApiClient.ts` | Verified | `/api/tutor` is not the live route |
| Route to service wiring | Session route should reach service | Confirmed route calls `sessionMessageApiService.sendMessageForUser(...)` | `src/app/api/sessions/[sessionId]/messages/route.ts` | Verified | Wiring is intact |
| File inventory branch reachability | File inventory questions should classify into inventory branch | Exact smoke-test phrase classified as `general_tutor_question` | direct classifier run against `src/server/tutor/requestClassifier.ts` | Failed | This is the decisive break |
| Inventory service invocation | Inventory question should call `listUploadedFiles`, `listFileChunks`, and `buildFileInventory` | Exact phrase did not call those methods | direct diagnostic service trace | Failed | Branch never reached |
| Model bypass | File inventory question should not rely on model/provider first | Model/provider path was called | direct diagnostic service trace | Failed | Wrong branch selected |
| File readiness semantics | Ready file in UI should be usable for inventory | `FilePanel` readiness is stricter than inventory needs | `src/components/files/FilePanel.tsx`, `src/server/workspaces/sessionMessageApiService.ts` | Verified | Not the root cause |
| Retrieval grounding placeholder block | Placeholder content should not ground responses | Previously repaired | prior repair report and current code inspection | Verified | Separate issue, not this failure |

## 15. Exact failure point

- Exact failure point: request classification in `src/server/tutor/requestClassifier.ts`
- The phrase `איזה קבצים העליתי לסביבת העבודה הזאת ומה יש בהם?` is not recognized as `file_content_inventory` or equivalent file-aware intent.
- Because of that miss, `sessionMessageApiService` never reaches `listUploadedFiles(...)`, `listFileChunks(...)`, or `buildFileInventory(...)` for this request.

## 16. Root cause

- Primary root cause: intent coverage gap in the classifier.
- The existing inventory patterns cover narrower “questions/exercises/list from a file” phrasing, but not broader “which files did I upload / what is in them” phrasing.
- This is a classification defect, not primarily a storage, route, session, or post-refresh processing defect.

## 17. Why prior tests and tools missed it

- Existing tests validate narrower file inventory phrasing and repaired branches, not this broader Hebrew phrasing.
- Prior recovery work proved that the inventory path exists and that processing state persists, but did not prove that all realistic user phrasings reach that path.
- Graphify was useful for finding the pipeline shape and relevant files, but it could not by itself prove the runtime branch choice for the exact smoke-test phrase.
- The decisive proof required direct classifier execution and direct service-level tracing with the exact user wording.

## 18. Smallest safe fix

- Extend classifier coverage in `src/server/tutor/requestClassifier.ts` so file inventory intent catches phrasing such as:
  - “איזה קבצים העליתי…”
  - “אילו קבצים יש לי…”
  - “מה יש בהם…”
  - combined file-list plus file-contents summary requests
- Keep the fix narrow and classification-focused.
- Do not broaden unrelated tutor intents.

## 19. Recommended tests

- Add a classifier test for the exact smoke-test phrase:
  - `איזה קבצים העליתי לסביבת העבודה הזאת ומה יש בהם?`
- Add classifier tests for close Hebrew variants that ask for uploaded-file inventory and short contents summary.
- Add a `sessionMessageApiService` test proving the exact phrase:
  - reaches the inventory branch
  - calls `listUploadedFiles(...)`
  - calls `listFileChunks(...)`
  - calls `buildFileInventory(...)`
  - does not call the model/provider path first
- Optionally add a route/client integration test around `/api/sessions/[sessionId]/messages` for the same phrase.

## 20. Remaining risks

- `buildFileInventory(...)` currently inventories only the first ready file, which may underrepresent multi-file workspaces.
- The placeholder grounding repair is still string-match based and may not catch future placeholder variants unless expanded.
- The “sources” context repair is truthful at file-count level, but not a fine-grained readiness explanation.
- Pre-existing lint failures remain outside this diagnostic scope.

## 21. Ready-for-repair assessment

- Ready for repair: **YES**
- Immediate code fix required before smoke testing the exact phrase again: **YES**
- Reason: without classifier coverage for this phrasing, the same user wording is expected to fail again even though the rest of the repaired pipeline is largely intact.

## 22. Safety confirmations

- No source files were edited.
- No implementation changes were made.
- No `git add` was run.
- No `git commit` was run.
- No `git push` was run.
- No `git pull` was run.
