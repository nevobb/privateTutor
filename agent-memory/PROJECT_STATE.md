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
- Step 40A/40B/40C — provider boundary + DeepSeek smoke/history wiring — complete and merged.
- Step 41B/41C/41D/41E — decision-log persistence, diagnostics API/panel, composer layout, dev diagnostics toggle — complete and merged.
- Batch 2 — Phase 7.2 move closure + Phase 15 subset tests — complete and merged.
- Batch 3 — retrieval decision boundary (read-only, no retrieval execution) — complete and merged.

## Pending PR milestone
- Batch 4 / Phase 8 — metadata-first file intake/classify/index lifecycle — implemented on branch and pending merge in PR #43.
- Important: this milestone is metadata-only and does not include binary upload, Firebase Storage ingestion, text extraction, real vector/chunk indexing, retrieval execution, or summary generation.

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
- File text extraction/parsing not implemented.
- Real retrieval index/chunk execution not implemented.
- File-content summary generation not implemented.
- Web search not implemented.
- Production Firebase deployment not done.
- Subspace not integrated into the app and not part of MVP.

## Current repo-memory status
- This is Part 3 of the repo-native memory layer.
- Existing files after this part:
  - `AGENTS.md`
  - `AGENT_TASK_PROTOCOL.md`
  - `agent-memory/PROJECT_STATE.md`
  - `agent-memory/CURRENT_TASK.md`
  - `agent-memory/DECISIONS.md`
  - `agent-memory/TASK_LOG.md`
  - `agent-memory/AGENT_HANDOFF.md`
  - `agent-memory/OPEN_QUESTIONS.md`
- Initial repo-native memory layer is complete after PR merge.
- Future tasks must maintain these files.

## Current/next memory step
- Current: Batch 4 / Phase 8 PR review and merge readiness.
- Next: Batch 4 / Phase 9 (metadata-only summary lifecycle contract), only after explicit approval.

## Last known safe base
`origin/main` after PR #35 merge (`1ac077d`).
