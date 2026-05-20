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
- Step 25 semantic retrieval execution completed on branch `codex/phase25-semantic-retrieval-execution`.
- Hybrid semantic + keyword fallback behavior is active.

## What Step 25 added
- Semantic chunk retrieval service with deterministic cosine ranking.
- Hybrid retrieval integration in existing retrieval service.
- Retrieval method metadata (`semantic`, `keyword_fallback`, `keyword_only`).
- Decision-log detail enrichment for semantic attempt/use/fallback reason.
- Focused tests for semantic ranking and fallback behavior.

## What is still out of scope
- Real embedding provider integration.
- External vector DB.
- Parser changes.
- Gemini/Genkit.

## Next recommended step
- Evaluate retrieval quality with real learning materials and decide on real embedding provider integration.
