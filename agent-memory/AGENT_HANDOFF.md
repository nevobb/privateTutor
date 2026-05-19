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
- Phase 16 extraction boundary is implemented on branch `codex/phase16-text-extraction-boundary`.
- Build and focused test suites are passing.

## What Phase 16 added
- Uploaded-file extraction lifecycle fields and safe legacy mapping.
- Deterministic extraction provider boundary (`fileExtractionProvider`).
- Extraction service flow in uploaded-file service.
- New API route: `POST /api/workspaces/[workspaceId]/files/[fileId]/extract`.
- Extraction decision-log events persisted under `decisionType: file_extraction`.

## What is still out of scope
- Real PDF/DOCX parsing implementation.
- OCR.
- Retrieval over extracted text.
- Summary generation from extracted text.
- Tutor grounding on uploaded file content.
- Gemini/Genkit.

## Next recommended step
- Implement real parser adapter behind current extraction provider boundary or start chunking boundary, while still keeping tutor retrieval disabled until explicitly scoped.
