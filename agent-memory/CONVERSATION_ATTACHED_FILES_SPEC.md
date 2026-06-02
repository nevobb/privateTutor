---
name: conversation-attached-files-spec
description: Full spec for conversation-level file attachment feature — attach files to specific sessions, priority retrieval, no storage duplication. BLOCKED until file-learning-workflow-stabilization is pushed and verified.
metadata:
  type: project
---

# Conversation-Attached Files + Workspace File Library — Feature Spec

**Status: BLOCKED — do not start until file learning workflow stabilization is pushed and verified.**

## Why
Files are currently workspace-level only. Real study conversations need a session-level attachment so the tutor treats an attached file as primary context for that specific chat.

**How to apply:** When this task is unblocked, implement incrementally. Read all existing file handling code before touching anything.

## Two levels of file context
1. Workspace / course file library — files belong to course/topic, reusable across sessions
2. Conversation-attached files — linked to one session, treated as primary retrieval source

## Data model
Preferred subcollection (supports focus mode, ordering, detach history):
```
users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}/attachedFiles/{fileId}
{
  fileId: string;
  workspaceId: string;
  sessionId: string;
  attachedAt: timestamp;
  attachedBy: string;
  focusMode?: "primary" | "reference";
  lastUsedAt?: timestamp;
}
```
Flat alternative: `attachedFileIds: string[]` on session doc.

## API routes to add
```
GET  /api/sessions/[sessionId]/attached-files?workspaceId=...
POST /api/sessions/[sessionId]/attached-files   { workspaceId, fileId }
DELETE /api/sessions/[sessionId]/attached-files/[fileId]
```

## Upload via chat flow
Upload → create workspace file metadata → attach fileId to session → Extract → Chunk → Embed → Ready

## Attach existing file
Validate ownership, same workspace, file exists → link relation → no re-upload, no re-processing if Ready

## Retrieval priority
1. Chunks from session-attached files
2. Other ready workspace files
3. Learner memory / tutor context

## UI requirements
- Attach/plus affordance near chat input
- Upload new PDF/DOCX or pick from workspace library
- Compact attached-files strip in chat (filename truncated, status)
- RTL clean, no clutter

## Tutor behavior
- If attached Ready: "אני יכול להשתמש בטקסט שחולץ מהקובץ המצורף לשיחה."
- If processing: "הקובץ עדיין בעיבוד..."
- If failed: "העיבוד נכשל, נסה שוב."
- Visual limitation: mention only for diagram/graph/circuit questions
- Never: "I cannot access uploaded files" when ready attached files exist

## Security
- All routes require auth
- Paths under users/{userId}/...
- Cannot attach files from another user or workspace

## Hard limits
- No Storage duplication
- No separate copies of same uploaded file document
- No break to existing workspace-level retrieval
- No: user preferences, rename sessions, delete sessions, OCR, visual PDF understanding
- No push without review

## Test coverage required
1. Attach existing workspace file to session
2. Upload via chat attaches to session
3. No Storage duplication
4. Session-attached files load with session context
5. Retrieval prioritizes attached file chunks
6. Fallback to workspace files if attached irrelevant
7. Cannot attach another user's file
8. Cannot attach from wrong workspace
9. Detach removes link, not workspace file
10. Tutor doesn't say no-access when ready attached files exist
11. Attached file list survives refresh

## Validation
```bash
npm run build
npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts tests/server/workspaces/fileChunkRetrievalService.test.ts tests/server/workspaces/fileChunkSemanticRetrievalService.test.ts
git diff --check
gitleaks detect --source . --no-git --redact
gitleaks detect --source . --redact
```

## Report to create
agent-memory/CONVERSATION_ATTACHED_FILES_REPORT.md
