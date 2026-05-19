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
- Step 23 semantic/vector retrieval architecture decision is completed on branch `codex/phase23-semantic-retrieval-decision`.
- Runtime behavior is unchanged.

## What Step 23 added
- `docs/SEMANTIC_RETRIEVAL_DECISION.md` with:
  - recommended staged hybrid approach
  - embedding lifecycle design
  - vector storage strategy
  - hybrid retrieval strategy + keyword fallback
  - cost-mode and failure behavior
  - migration path and next phases

## What is still out of scope
- Embedding generation/runtime calls.
- Vector DB integration.
- Semantic retrieval execution.
- Parser changes.

## Next recommended step
- Implement Step 24: Embedding Lifecycle Boundary only (no semantic retrieval execution).
