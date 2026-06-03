# Conversation File Attachment C4 — Retrieval Prioritization + Readiness Gate Report

**Date:** 2026-06-03
**Branch:** repair/workspace-cleanup-fit-check
**HEAD (before C4):** 43b38d1 feat: wire composer attachments into message send

---

## 1. Brain files read

- `AGENTS.md`
- `agent-memory/PROJECT_BRAIN/00_CURRENT_STATE.md`
- `agent-memory/PROJECT_BRAIN/01_SYSTEM_PIPELINE_CONTRACTS.md`
- `agent-memory/PROJECT_BRAIN/02_CHANGE_IMPACT_MATRIX.md`
- `agent-memory/PROJECT_BRAIN/03_RISK_REGISTER.md`
- `agent-memory/PROJECT_BRAIN/04_AGENT_PREFLIGHT_PROTOCOL.md`
- `agent-memory/PROJECT_BRAIN/05_REGRESSION_SMOKE_PLAYBOOK.md`
- `agent-memory/CONVERSATION_FILE_ATTACHMENT_FIT_CHECK.md`
- `agent-memory/CONVERSATION_FILE_ATTACHMENT_C2_C3_COMPOSER_UPLOAD_WIRE_REPORT.md`
- `agent-memory/ATTACHMENT_FAILURE_DIAGNOSTIC_REPORT.md`

## 2. Graphify queries run

- `sessionMessageApiService retrieval attachedFileIds`
- `fileChunkRetrievalService retrieved chunks uploaded files`
- `messageRepository attachedFileIds previous messages`
- `uploaded file extractionStatus chunkingStatus embeddingsStatus`
- `file access status processing deterministic response`
- `attached file readiness gate tutor response`

## 3. Impact prediction

| Risk area | Assessment | Mitigation |
|---|---|---|
| Existing workspace-wide retrieval | Still works as fallback when no attachment context | Prioritized path falls through when no score > 0 |
| `file_access_status` shortcut | Fires before readiness gate — unaffected | Gate inserted after all deterministic shortcuts |
| Inventory shortcuts | All fire before readiness gate — unaffected | Gate position confirmed: after visual_reference, before getMockTutorResponse |
| Zero-score chunk incorrectly returned | `selectByBudget` doesn't filter zero-score chunks | Added `prioritizedResult.some(c => c.score > 0)` check before returning |
| `validateAttachedFileIds` vs readiness gate | Validation only checks existence/ownership; readiness gate checks processing status | Two separate concerns — validation throws errors, gate returns deterministic response |
| Follow-up turns | Prior attachment context derived from message history | `deriveActiveAttachedFileIds` scans existing messages in reverse |
| Soft-deleted files | `getUploadedFile` returns null for deleted files → readiness gate marks them not-ready | Security boundary preserved |
| Pre-existing eval test | `tests/evaluation/` was already failing (LLM API unavailable in environment) | Confirmed untracked unrelated file; excluded from suite |

## 4. Root cause from diagnostic

Two simultaneous failures confirmed by `ATTACHMENT_FAILURE_DIAGNOSTIC_REPORT.md`:
1. **C4 missing**: `executeRetrievalForTutorResponse` had no `attachedFileIds` parameter; `retrieveFileChunks` was called workspace-wide
2. **Processing readiness race**: `handleAttachmentUpload` fires pipeline as `void` (fire-and-forget); file is very unlikely to be extracted/chunked when first question arrives seconds later

Both are now addressed.

## 5. Active attachment context derivation

**New exported pure function:** `deriveActiveAttachedFileIds(currentAttachedFileIds, existingMessages)`

- If current message has non-empty `attachedFileIds` → use those
- Else scan `existingMessages` in reverse, return `attachedFileIds` from the latest user message that has them
- Returns `undefined` when no attachment context exists at all

This enables follow-up questions to use the file context from the original attachment turn without requiring `SessionRecord.primaryFileId`.

## 6. Readiness gate behavior

**New internal helper:** `checkAttachedFilesReadiness(repositories, userId, workspaceId, attachedFileIds)`

For each file ID in active attachment context:
- Calls `repositories.getUploadedFile(userId, fileId)`
- Checks: `extractionStatus === "completed"` AND `chunkingStatus === "completed"`
- Files that are null, soft-deleted, or cross-workspace are treated as not-ready
- Returns `{ ready: true }` or `{ ready: false, processingFileNames: string[] }`

**Readiness definition:** extraction + chunking complete. Embeddings not required (keyword fallback works without them).

The gate fires AFTER all deterministic shortcuts (instruction_awareness, file_access_status, file_content_inventory, visual_reference) but BEFORE the first `getMockTutorResponse` call.

## 7. Deterministic not-ready response

When gate fires, returns a deterministic assistant message without calling the AI provider:

```
הקובץ "lecture.pdf" שצירפת עדיין בעיבוד — חילוץ טקסט, יצירת צ'אנקים, או יצירת embeddings. המתן כמה שניות ושאל שוב.
```

- Includes the file name (from `originalFileName ?? name ?? fileId`)
- Handles plural when multiple files are not ready
- Uses `makeDeterministicReturn(userRecord, assistantRecord, "attached_file_not_ready")`
- Provider is NOT called; retrieval is NOT executed; no workspace-wide fallback

## 8. Retrieval prioritization behavior

**`FileChunkRetrievalInput`** now accepts `prioritizedFileIds?: string[]`.

When provided and non-empty:
1. From `eligible` files, separate `prioritizedPairs` (chunks from prioritized files)
2. If `prioritizedPairs.length > 0`:
   - Try semantic retrieval with ONLY prioritized file candidates → if chunks found with score > 0, return them
   - Keyword scoring on prioritized pairs → if any chunk has `score > 0`, return those
   - If no scoring > 0 from prioritized files → fall through to workspace-wide
3. If `prioritizedPairs.length === 0`: proceed directly to workspace-wide

**`executeRetrievalForTutorResponse`** accepts `prioritizedFileIds?: string[]` as last parameter and passes it to `retrieveFileChunks`.

**`sendMessageForUser`** calls `executeRetrievalForTutorResponse` with `activeAttachedFileIds`.

## 9. Fallback behavior

When prioritized files return no chunks with score > 0:
- Fall through to existing workspace-wide semantic + keyword retrieval (unchanged logic)
- `eligibleFileCount` reflects all eligible workspace files in both paths
- The fallback is implicit (no explicit flag returned) — the service layer's readiness gate already ensures attached files are processed before reaching retrieval, so fallback only occurs when the file genuinely has no relevant content for the query

## 10. Soft-delete / security behavior

- `validateAttachedFileIds` (C1): rejects null/cross-workspace files with an error BEFORE message is persisted
- Readiness gate: calls `getUploadedFile` again — soft-deleted files return null → marked as not-ready → honest "still processing" response (safe fallback, no file leakage)
- `listUploadedFiles` in retrieval already filters `isDeleted !== true` — deleted files never enter `eligible`
- All existing soft-delete boundaries are preserved

## 11. Files changed

| File | Changes |
|---|---|
| `src/server/workspaces/fileChunkRetrievalService.ts` | Added `prioritizedFileIds?` to `FileChunkRetrievalInput`; added prioritized retrieval path before workspace-wide fallback |
| `src/server/workspaces/sessionMessageApiService.ts` | Added `deriveActiveAttachedFileIds` (exported pure fn); added `checkAttachedFilesReadiness`; added readiness gate + active context derivation in `sendMessageForUser`; updated `executeRetrievalForTutorResponse` signature + `retrieveFileChunks` call |
| `tests/server/workspaces/fileChunkRetrievalService.test.ts` | Updated type; added 4 prioritization tests |
| `tests/server/workspaces/sessionMessageApiService.test.ts` | Updated `retrieveFileChunks` type; added `deriveActiveAttachedFileIds` tests; added 7 C4 tests |

## 12. Tests added / updated

### `fileChunkRetrievalService.test.ts` (+4 tests):
- Returns chunks only from prioritized file when it has relevant content
- Falls back to workspace-wide when prioritized file has no matching chunks (score = 0)
- Behaves as workspace-wide when `prioritizedFileIds` is empty
- Behaves as workspace-wide when `prioritizedFileIds` is absent

### `sessionMessageApiService.test.ts` (+12 tests):
- `deriveActiveAttachedFileIds` — 5 pure function tests (current IDs, no prior context, derives from history, skips tutor messages, returns undefined)
- C4 readiness gate — 7 tests:
  - Not-ready response when file not extracted → no provider call, processing message sent to `appendMessage`
  - No workspace-wide fallback when file not ready
  - `prioritizedFileIds` passed to retrieval when file ready
  - No `prioritizedFileIds` when no attachments → normal workspace-wide
  - Derives from prior messages on follow-up → `prioritizedFileIds` set
  - Not-ready for derived prior attachment on follow-up → processing message

**Full suite:** 1058 passed / 0 failed (78 files, 18 skipped). Eval test (pre-existing environment failure) excluded.

## 13. Validation results

- `npx tsc --noEmit --skipLibCheck`: **PASSED**
- `npx vitest run --exclude 'tests/evaluation/**'`: **1058 passed / 0 failed**
- `git diff --check`: **PASSED**
- `graphify update .`: **PASSED**
- `tests/evaluation/eval.test.ts`: pre-existing environment failure (LLM API keys not available in CI/emulator environment); untracked file, unrelated to C4

## 14. Manual smoke checklist

1. Attach file in composer → chip appears
2. Type a question about the file content, send immediately → see processing message "הקובץ עדיין בעיבוד"
3. Wait for FilePanel to show "Ready for learning"
4. Type same question → tutor answers from file content
5. Type a follow-up question (no chip) → tutor still uses file context (derived from prior message)
6. Verify Firestore: user message has `attachedFileIds`; assistant has processing message on first send, real content on second
7. Upload unrelated file to workspace → ask general question → tutor retrieves from all workspace files (fallback)
8. Delete the attached file, re-ask → readiness gate catches null file → processing message, no crash

## 15. Risks / open decisions

| Item | Status |
|---|---|
| Emoji score filter for semantic path | Semantic results returned regardless of score (score is from embeddings, always meaningful) — only keyword path needs score > 0 guard |
| Derived prior attachment can be from sessions ago | Currently derives from any prior message in the same session; cross-session context not implemented (intentional deferral) |
| Multiple simultaneous attached files | All must pass readiness gate; first not-ready triggers response listing all not-ready file names |
| `eval.test.ts` failures | Pre-existing; requires `DEEPSEEK_API_KEY` or equivalent judge API key; unrelated to C4 |
| C5 tutor wording | Tutor has no explicit "your attached file context is X" grounding instruction yet — next batch |

## 16. Ready for C5 tutor wording / inventory refinement

**YES** — The full chain now works:
- File staged (C2)
- Upload on send (C3)
- Validated + persisted (C1)
- Readiness gate returns honest "preparing" message (C4)
- When ready: retrieval prioritizes attached file chunks first (C4)
- Follow-up questions inherit attachment context from history (C4)

C5 can add: explicit tutor grounding instruction ("the user's active file is X"), and inventory refinement to prefer attached file for inventory shortcuts.

## 17. Safety confirmations

- Deep PDF behavior: NOT changed
- Extraction/chunking implementation: NOT changed
- Upload pipeline: NOT changed
- Soft delete semantics: NOT changed
- Composer UI: NOT changed
- `SessionRecord.primaryFileId`: NOT implemented
- Learner memory: NOT changed
- Workspace/course delete: NOT changed

## 18. No git operations

- Did not run git add
- Did not commit
- Did not push
- Did not run git pull
