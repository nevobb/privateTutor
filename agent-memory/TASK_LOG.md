# Task Log

## Recent tasks

### Phase 19 — Provider prompt-context injection / grounded tutor answer
- Branch: `codex/phase19-grounded-tutor-answer`
- Status: implemented on branch
- Result:
  - Added `GroundingChunkContext` / `TutorGroundingContext` types; `groundingContext?` on `TutorRequest`.
  - Added `deepseekGroundingPrompt.ts` with bounded SOURCE block formatter.
  - DeepSeek provider injects SOURCE blocks when `groundingContext` provided.
  - Mock provider surfaces grounding metadata in decision log.
  - Session service: second provider call with grounding context when chunks found; message content replaced with grounded answer.
  - Tests: 5 grounding prompt unit tests + 6 session grounding integration tests.
- Notes:
  - MVP full pipeline complete (upload → extract → chunk → retrieve → ground → answer).
  - Retrieval is deterministic keyword-based, NOT semantic.
  - Real extraction placeholder still active; no embeddings added.

### Phase 18 — Retrieval over persisted file chunks
- Branch: `codex/phase18-retrieval-over-file-chunks`
- Status: implemented on branch
- Result:
  - Added `fileChunkRetrievalService.ts` with deterministic keyword/token chunk ranking.
  - Wired chunk retrieval into session message service non-web path.
  - Citations reference chunk ids and file ids.
  - Fallback to old indexed-file retrieval when no chunked files exist.
  - Added focused tests: 9 service unit tests + 6 integration tests.
- Notes:
  - Tutor response text still not grounded on chunk content.
  - Provider prompt injection is explicitly out of scope for this phase.
  - No embeddings or vector retrieval added.

### Phase 17 — File chunking boundary
- Branch: `codex/phase17-file-chunking-boundary`
- Status: merged (#50)
- Result:
  - Added chunking lifecycle fields to uploaded-file metadata.
  - Added deterministic chunker and file chunk repository.
  - Added chunking service lifecycle and API route:
    - `POST /api/workspaces/[workspaceId]/files/[fileId]/chunks`
  - Added chunking decision-log lifecycle events.
  - Added focused tests for chunker/repository/service/route and regressions.

### Phase 16 — Text extraction/parsing boundary
- Branch: `codex/phase16-text-extraction-boundary`
- Status: merged
- Result:
  - Added extraction lifecycle fields + deterministic extraction provider boundary.

### Phase 15 — Real file upload foundation
- Branch: `codex/phase15-real-file-upload-foundation`
- PR: #48
- Status: merged
- Result: client upload to Storage + metadata linkage through existing workspace files API.

### Batch 5 / Phase 14 — Web search execution boundary
- PR: #47
- Status: merged
