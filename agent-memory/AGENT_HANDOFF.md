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
- Step 24 embedding lifecycle boundary is completed on branch `codex/phase24-embedding-lifecycle-boundary`.
- Runtime retrieval behavior is unchanged.

## What Step 24 added
- Embedding lifecycle metadata fields on file chunks.
- Deterministic mock embedding provider boundary.
- Embedding storage/repository boundary under chunk embedding subdocument path.
- Embedding lifecycle service and route:
  - `POST /api/workspaces/[workspaceId]/files/[fileId]/embeddings`
- Focused tests for provider/repository/service/route.

## What is still out of scope
- Real embedding provider integration.
- Vector DB.
- Semantic retrieval execution.
- Parser or extraction runtime changes.

## Next recommended step
- Step 25: semantic retrieval execution with hybrid ranking and keyword fallback.
