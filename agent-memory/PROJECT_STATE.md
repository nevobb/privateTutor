# Project State

## Project identity
- privateTutor is a personal adaptive academic tutor.
- Core principle: Understanding before progress.
- Direction: build a deeper personal tutor, not a broader learning platform.
- Not an LMS, dashboard, generic chatbot, or agent platform.

## Current completed milestones
- Step 38C/38D — Research-based UX corrections — complete and merged via PR #30.
- Step 39 — Session transcript/message API boundary — complete and merged via PR #31.
- Step 39.5 — Agent Task Protocol — complete and merged via PR #33.

## Current capabilities
- Auth emulator flow works.
- Workspace API/UI exists.
- Session API/UI exists.
- Session transcript persistence exists.
- Messages persist by session.
- Server owns mock tutor response generation.
- Browser no longer calls mock tutor directly.
- Cross-user access is blocked.
- Firestore rules remain strict owner-only.
- Collapsible sidebar and visible Context strip exist.
- `AGENT_TASK_PROTOCOL.md` exists.

## Still mocked / not implemented
- Real Gemini provider not connected.
- Genkit not connected.
- Retrieval not implemented.
- Learner memory persistence not implemented.
- File upload / Firebase Storage not implemented.
- Web search not implemented.
- Production Firebase deployment not done.
- Subspace not integrated into the app and not part of MVP.

## Current repo-memory status
- This is Part 1 of the repo-native memory layer.
- Existing files after this part:
  - `AGENTS.md`
  - `AGENT_TASK_PROTOCOL.md`
  - `agent-memory/PROJECT_STATE.md`
  - `agent-memory/CURRENT_TASK.md`
- Later parts should add:
  - `agent-memory/DECISIONS.md`
  - `agent-memory/TASK_LOG.md`
  - `agent-memory/AGENT_HANDOFF.md`
  - `agent-memory/OPEN_QUESTIONS.md`

## Last known safe base
`origin/main` after PR #33 merge (`255d996`).
