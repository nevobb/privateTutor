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
- Step 26 Gemini embedding provider integration completed on branch `codex/phase26-gemini-embedding-provider`.
- Semantic retrieval can use real Gemini embeddings when configured.

## What Step 26 added
- Server-only Gemini embeddings provider (`gemini-embedding-001`).
- Env-based provider selection (`EMBEDDING_PROVIDER`, `GEMINI_API_KEY`).
- Task-type separation:
  - `RETRIEVAL_DOCUMENT` for chunk/document embeddings
  - `QUESTION_ANSWERING` for query embeddings
- Unchanged-hash chunk embedding skip optimization.
- Semantic failure path remains keyword fallback.

## What is still out of scope
- Vector DB.
- Gemini chat/Genkit migration.
- Parser changes.
- OCR/summaries.

## Next recommended step
- Retrieval quality evaluation and provider tuning before broader rollout.
