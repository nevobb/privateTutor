# Repository Agent Entry Point

Before working in this repository, read:
1. `AGENT_TASK_PROTOCOL.md`
2. `agent-memory/PROJECT_STATE.md`
3. `agent-memory/CURRENT_TASK.md`
4. `agent-memory/DUAL_AGENT_SYNC_LOG.md`
5. `agent-memory/PROJECT_BRAIN/00_CURRENT_STATE.md`
6. `agent-memory/PROJECT_BRAIN/04_AGENT_PREFLIGHT_PROTOCOL.md`

The repo-native memory files are the source of truth for agent continuity.
Chat history is useful context, but not authoritative.
External workflow tools such as Subspace may help coordinate agents, but are not part of the privateTutor MVP architecture.

Do not begin implementation until the active task and scope are clear in `agent-memory/CURRENT_TASK.md`.

After every completed step/task, the active agent must append an entry to `agent-memory/DUAL_AGENT_SYNC_LOG.md` (Codex and Claude both).

More `agent-memory` files will be added in later steps.

## project brain

Before implementation, agents must read the relevant `agent-memory/PROJECT_BRAIN/` files for the task, not just the current task log.

Every implementation report must include:
- which brain files were read
- an impact prediction
- what could regress
- which tests and smoke checks were used

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
