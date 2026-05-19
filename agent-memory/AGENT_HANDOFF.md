# Agent Handoff

## Read order
1. `AGENT_TASK_PROTOCOL.md`
2. `AGENTS.md`
3. `agent-memory/PROJECT_STATE.md`
4. `agent-memory/CURRENT_TASK.md`
5. `agent-memory/DECISIONS.md`
6. `agent-memory/TASK_LOG.md`
7. `agent-memory/OPEN_QUESTIONS.md`

## Current status
- `origin/main` includes Batch 5 / Phase 14.
- Current branch implements Phase 15 real file upload foundation.
- Build is passing and focused upload/file tests are passing on this branch.

## What Phase 15 added
- Client helper for PDF/DOCX validation + Storage upload.
- Workspace-owned storage path convention:
  - `users/{userId}/workspaces/{workspaceId}/files/{fileId}/{safeFileName}`
- Metadata creation continues through existing API:
  - `POST /api/workspaces/[workspaceId]/files`
- Server-side validation hardened for `storagePath` ownership/path format.
- Minimal upload UI in sidebar File panel with explicit status states.

## What is still out of scope
- File parsing/extraction/OCR.
- Real retrieval over extracted content.
- Real summary generation from file contents.
- Gemini/Genkit.
- Production Firebase deployment.

## Next recommended step
- Implement text extraction/parsing boundary for uploaded PDF/DOCX files.
