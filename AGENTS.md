# Repository Agent Entry Point

Before working in this repository, read:
1. `AGENT_TASK_PROTOCOL.md`
2. `agent-memory/PROJECT_STATE.md`
3. `agent-memory/CURRENT_TASK.md`
4. `agent-memory/DUAL_AGENT_SYNC_LOG.md`

The repo-native memory files are the source of truth for agent continuity.
Chat history is useful context, but not authoritative.
External workflow tools such as Subspace may help coordinate agents, but are not part of the privateTutor MVP architecture.

Do not begin implementation until the active task and scope are clear in `agent-memory/CURRENT_TASK.md`.

After every completed step/task, the active agent must append an entry to `agent-memory/DUAL_AGENT_SYNC_LOG.md` (Codex and Claude both).

More `agent-memory` files will be added in later steps.
