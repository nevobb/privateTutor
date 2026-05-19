# Task Log

## Recent tasks

### Phase 15 — Real file upload foundation
- Branch: `codex/phase15-real-file-upload-foundation`
- Status: implemented on branch
- Result:
  - Added client-side PDF/DOCX validation and upload helper to Firebase Storage.
  - Added workspace files API client for metadata create/list.
  - Added minimal sidebar upload flow with statuses (validating/uploading/saving/done/error).
  - Added strict server validation for `storagePath` ownership and path format.
  - Kept metadata lifecycle compatibility (Phase 8/9/10 behavior intact).
- Notes:
  - No parsing/OCR/extraction.
  - No real retrieval over file contents.
  - No Gemini/Genkit.

### Batch 5 / Phase 14 — Web search execution boundary
- Branch: `codex/batch5-phase14-web-search`
- PR: #47
- Status: merged
- Result: policy-gated web retrieval path with deterministic provider behavior and decision-log coverage.

### Batch 5 / Phase 13 — Work mode policy hardening
- Status: merged

### Batch 5 / Phase 12 — Cost mode retrieval caps
- Status: merged

### Batch 5 / Phase 11 — Learner memory boundary
- Status: merged
