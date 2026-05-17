# Task Log

This file records concise completed task history.
Full details live in PRs and task reports.

## Recent tasks

### Step 38C/38D — Research-based UX corrections
- Branch: `design/research-based-ux-corrections-final`
- PR: #30
- Status: merged
- Result: added collapsible sidebar, visible collapse/expand controls, and Context strip.
- Notes: UI/design only; no backend/package changes.

### Step 39 — Session transcript/message API boundary
- Branch: `feat/session-transcript-api-boundary`
- PR: #31
- Status: merged
- Result: added GET/POST session messages API, persisted messages by session, and moved mock tutor response generation to server.
- Notes: Firestore rules final state remains strict owner-only; no Gemini/Genkit/retrieval/memory added.

### Step 39.5 — Agent Task Protocol
- Branch: `docs/agent-task-protocol-clean`
- PR: #33
- Status: merged
- Result: added `AGENT_TASK_PROTOCOL.md`.
- Notes: documentation/process only.

### Step 39.6A — Agent memory entry point and current state
- Branch: `docs/agent-memory-part-1`
- PR: #34
- Status: merged
- Result: added root `AGENTS.md` entry point plus `PROJECT_STATE` and `CURRENT_TASK`.
- Notes: documentation/state only.

### Step 39.6B — Agent decisions and task history
- Branch: `docs/agent-memory-part-2`
- PR: pending
- Status: in progress
- Result: adds `DECISIONS` and `TASK_LOG`.
- Notes: documentation/state only.
