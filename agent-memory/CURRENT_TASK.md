# Current Task

## Status
No active implementation task is currently running.

## Next proposed task
Step 39.6B — Add agent decisions and task history.

Do not start Step 40 until the repo-native memory layer is complete.

## Recommended next branch
`docs/agent-memory-part-2`

## Part 2 expected files
- `agent-memory/DECISIONS.md`
- `agent-memory/TASK_LOG.md`

## Step 40 is not active yet
Step 40 is expected to involve tutor provider / Gemini / Genkit planning or integration, but it is intentionally paused until the repo-memory layer is complete.

Before Step 40, Nevo should decide whether to do:
A. provider abstraction / preflight first
B. direct Gemini + Genkit integration

Strong recommendation:
Do provider abstraction / preflight first unless Nevo explicitly approves direct Gemini connection.

## Must follow
- `AGENT_TASK_PROTOCOL.md`
- `AGENTS.md`
- `agent-memory/PROJECT_STATE.md`
- this file

## Forbidden in the current state
- Do not add Gemini.
- Do not add Genkit.
- Do not add retrieval.
- Do not add learner memory persistence.
- Do not add file upload.
- Do not add Subspace integration.
- Do not change product architecture.
- Do not change package files unless explicitly approved.
- Do not deploy Firebase.
- Do not create `docs/superpowers/*`.
