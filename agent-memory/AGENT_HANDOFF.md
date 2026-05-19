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
- Phase 19 provider prompt-context injection implemented and validated.
- MVP upload → extract → chunk → retrieve → ground → answer pipeline is complete (with placeholder extraction).

## What Phase 19 added
- `GroundingChunkContext` / `TutorGroundingContext` types in `schemas.ts`.
- `groundingContext?: TutorGroundingContext` on `TutorRequest`.
- `deepseekGroundingPrompt.ts`: bounded SOURCE block formatter.
- DeepSeek provider injects SOURCE blocks into system prompt when grounding context provided.
- Mock provider records grounding metadata in decision log.
- Session service: after chunk retrieval, makes a second grounded provider call; replaces message content with grounded answer.

## Flow summary (Phase 19)
```
User message
  → provider call 1 (no grounding, classification + retrieval decision)
  → executeRetrievalForTutorResponse → chunk retrieval (Phase 18)
  → if chunks found: provider call 2 with groundingContext
  → message.content = grounded answer from call 2
  → citations, retrieval.used = true (Phase 18 metadata)
  → decision log: grounded provider call executed
```

## Important boundaries
- Retrieval is deterministic keyword-based. NOT semantic/vector.
- Real PDF/DOCX parsing not yet implemented (placeholder active).
- No embeddings, no Gemini/Genkit.

## Next recommended step
- Phase 20: end-to-end MVP validation / behavior regression testing with real uploaded files.
- OR: replace deterministic extraction placeholder with real PDF parser.
- OR: connect Gemini/real model provider for quality grounded answers.
