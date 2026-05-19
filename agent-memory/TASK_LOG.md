# Task Log

## Recent tasks

### Phase 16 — Text extraction/parsing boundary
- Branch: `codex/phase16-text-extraction-boundary`
- Status: implemented on branch
- Result:
  - Added extraction lifecycle fields to uploaded file metadata.
  - Added deterministic extraction provider boundary.
  - Added extraction service lifecycle and API route:
    - `POST /api/workspaces/[workspaceId]/files/[fileId]/extract`
  - Added extraction decision-log lifecycle events.
  - Added focused tests for provider/service/route/repository mapping.
- Notes:
  - Tutor still does not use extracted text for retrieval/answers.
  - No real PDF/DOCX parser dependency was added.

### Phase 15 — Real file upload foundation
- Branch: `codex/phase15-real-file-upload-foundation`
- PR: #48
- Status: merged
- Result: client upload to Storage + metadata linkage through existing workspace files API.

### Batch 5 / Phase 14 — Web search execution boundary
- PR: #47
- Status: merged
