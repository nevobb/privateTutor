# Current Task

## Status
No active implementation task is currently running.

## Next proposed task
Step 40A — Tutor provider boundary / Gemini-Genkit preflight.

Step 40 should start only after Nevo decides whether to do provider abstraction/preflight or direct Gemini + Genkit integration.

## Recommended next branch
`feat/tutor-provider-boundary-preflight`

## Step 40 decision gate
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
- Do not add packages unless explicitly approved.
- Do not add secrets or env files unless explicitly approved.
- Do not add direct Gemini connection unless explicitly approved.
- Do not add direct Genkit connection unless explicitly approved.
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
