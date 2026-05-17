# Repository Agent Entry Point

Before working in this repository, read:
1. `AGENT_TASK_PROTOCOL.md`
2. `agent-memory/PROJECT_STATE.md`
3. `agent-memory/CURRENT_TASK.md`

The repo-native memory files are the source of truth for agent continuity.
Chat history is useful context, but not authoritative.
External workflow tools such as Subspace may help coordinate agents, but are not part of the privateTutor MVP architecture.

Do not begin implementation until the active task and scope are clear in `agent-memory/CURRENT_TASK.md`.

More `agent-memory` files will be added in later steps.
