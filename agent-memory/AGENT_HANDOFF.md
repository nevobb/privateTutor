# Agent Handoff

## Read order
1. `AGENT_TASK_PROTOCOL.md`
2. `AGENTS.md`
3. `agent-memory/PROJECT_STATE.md`
4. `agent-memory/CURRENT_TASK.md`
5. `agent-memory/MVP_VALIDATION_REPORT.md`
6. `agent-memory/DECISIONS.md`
7. `agent-memory/TASK_LOG.md`
8. `agent-memory/OPEN_QUESTIONS.md`

## Current status
- Phase 20 MVP validation complete.
- Full pipeline validated: upload metadata → extraction boundary → chunking → keyword retrieval → grounded provider call → session transcript.

## MVP pipeline summary (Phases 15–19)
```
Upload (Phase 15)
  → Extraction boundary (Phase 16) — deterministic placeholder, no real PDF parser
  → Chunking (Phase 17) — persisted FileChunk under files/{fileId}/chunks/{chunkId}
  → Keyword retrieval (Phase 18) — token/keyword scoring, maxChunks + maxTokens budget
  → Grounded provider call (Phase 19) — SOURCE blocks in system prompt, second provider call
  → Session transcript — one user + one grounded tutor message
```

## Important boundaries
- Extraction is a deterministic placeholder — `extractedText` is stub, not real file content.
- Retrieval is keyword/token matching — NOT semantic, NOT vector, no embeddings.
- No Gemini, no Genkit, no OCR.

## Validated in Phase 20
- 15 behavior tests covering happy path, negative paths, and boundary assertions.
- Core regression tests: 43 passed.

## Next recommended step
1. **Real extraction parser** — replace deterministic placeholder with actual PDF parser. This is the highest-impact next step.
2. **Source transparency UI** — display chunk citations in chat.
3. **Semantic retrieval** — if keyword retrieval proves insufficient.
