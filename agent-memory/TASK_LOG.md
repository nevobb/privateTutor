# Task Log

## Recent tasks

### Phase 17 — File chunking boundary
- Branch: `codex/phase17-file-chunking-boundary`
- Status: implemented on branch
- Result:
  - Added chunking lifecycle fields to uploaded-file metadata.
  - Added deterministic chunker and file chunk repository.
  - Added chunking service lifecycle and API route:
    - `POST /api/workspaces/[workspaceId]/files/[fileId]/chunks`
  - Added chunking decision-log lifecycle events.
  - Added focused tests for chunker/repository/service/route and regressions.
- Notes:
  - Tutor still does not use chunk content for retrieval/answers.
  - No embeddings or vector retrieval was added.

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
