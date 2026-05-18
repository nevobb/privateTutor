# Agent Handoff

This file gives the next agent the shortest reliable path to continue privateTutor work.

## Read order

Before doing any work, read these files in order:

1. `AGENT_TASK_PROTOCOL.md`
2. `AGENTS.md`
3. `agent-memory/PROJECT_STATE.md`
4. `agent-memory/CURRENT_TASK.md`
5. `agent-memory/DECISIONS.md`
6. `agent-memory/TASK_LOG.md`
7. `agent-memory/OPEN_QUESTIONS.md`

## Current status

- Step 40A/40B/40C are complete and merged.
- Step 41B/41C/41D/41E are complete and merged.
- Batch 2 and Batch 3 are complete and merged.
- Batch 4 / Phase 8 is implemented on branch and currently pending merge in PR #43.
- Step 40+ is active; pre-Step40 notes in this file are outdated and replaced by `CURRENT_TASK.md`.

## Current product state

privateTutor currently supports:
- Auth emulator flow.
- Workspace API/UI.
- Session API/UI.
- Session transcript persistence.
- Server-owned mock tutor response generation.
- Persistent per-session messages after refresh.
- Collapsible sidebar and Context strip.
- Repo-native agent task protocol and memory files.

Still not implemented:
- Real Gemini provider.
- Genkit.
- Retrieval.
- Learner memory persistence.
- File upload / Firebase Storage.
- File text extraction/parsing.
- Real vector/chunk indexing.
- Retrieval execution.
- Real file-content summaries.
- Web search.
- Production Firebase deploy.

## Next recommended task after PR #43 merge

Recommended next task:
Batch 4 / Phase 9 (Option A only) — metadata-only summary lifecycle contract.

Recommended branch:
`codex/batch4-phase9-summary-lifecycle`

Recommended direction:
Keep it metadata-only and contract-first.
Do not imply or implement real summary generation from file content until binary upload + extraction exists.

## Do not touch without explicit approval

- `package.json`
- `package-lock.json`
- Firebase deploy/config for real cloud
- Firestore/Storage rules
- Provider secrets
- Gemini/Genkit real calls
- Retrieval
- Learner memory persistence
- File upload / Storage
- Subspace integration
- Product architecture changes
- UI redesign

## End-of-task update checklist

At the end of every future task, update:

- `agent-memory/PROJECT_STATE.md`
- `agent-memory/CURRENT_TASK.md`
- `agent-memory/TASK_LOG.md`
- `agent-memory/AGENT_HANDOFF.md`

Update only when relevant:

- `agent-memory/DECISIONS.md` — only for approved decisions.
- `agent-memory/OPEN_QUESTIONS.md` — only for unresolved questions requiring Nevo.
- Task-specific report file — only if requested.

## PR hygiene checklist

Before opening or finalizing any PR:

1. Confirm branch starts from `origin/main`.
2. Confirm PR base is `main`.
3. Run `git diff --name-status origin/main...HEAD`.
4. Confirm no forbidden files from `AGENT_TASK_PROTOCOL.md`.
5. Confirm no package changes unless explicitly approved.
6. Confirm no Firebase/rules changes unless explicitly scoped.
7. Confirm no Gemini/Genkit/retrieval/memory/file upload unless explicitly scoped.
8. Confirm state files are updated if the task changes project status.
