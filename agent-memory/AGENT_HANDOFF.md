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
- Phase 17 chunking boundary is implemented on branch `codex/phase17-file-chunking-boundary`.
- Build and focused test suites are passing.

## What Phase 17 added
- Uploaded-file chunking lifecycle fields and safe legacy mapping.
- Deterministic chunker (`fileChunker`) with stable chunk boundaries and overlap.
- File chunk repository persisted under file-scoped Firestore path.
- Chunking service lifecycle in uploaded-file service.
- New API route: `POST /api/workspaces/[workspaceId]/files/[fileId]/chunks`.
- Chunking decision-log events persisted under `decisionType: file_chunking`.

## What is still out of scope
- Embeddings/vector search/semantic retrieval.
- Tutor grounding from chunk content.
- OCR.
- Real PDF/DOCX parsing.
- Gemini/Genkit.

## Next recommended step
- Phase 18: retrieval integration over persisted chunks (policy-gated), keeping clear boundary from answer-grounding rollout.
