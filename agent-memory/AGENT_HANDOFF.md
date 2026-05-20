# Agent Handoff

## Read order
1. `AGENT_TASK_PROTOCOL.md`
2. `AGENTS.md`
3. `agent-memory/PROJECT_STATE.md`
4. `agent-memory/CURRENT_TASK.md`
5. `agent-memory/DECISIONS.md`
6. `agent-memory/TASK_LOG.md`
7. `agent-memory/OPEN_QUESTIONS.md`

## Current status
- Step 28B implemented locally on branch `step28b-production-firebase-mode` (not pushed).
- App now supports explicit Firebase runtime mode split (emulator vs production).

## What Step 28B changed
- Installed `firebase-admin` for server-only usage.
- Added server runtime mode logic and Firebase Admin app initialization.
- Added production token verifier and mode-based verifier selection.
- Switched server Firestore access to admin-backed DB while preserving existing repository contracts.
- Added client Firebase mode/runtime config with production env requirements and emulator-only connector behavior.
- Added visible user identity details and sign-out action in sidebar.
- Updated env example and added production setup doc.

## What is still out of scope
- Preferences persistence (theme/text size/line width).
- Session rename.
- Session archive/delete.
- Runtime mock cleanup.

## Next recommended step
Run full emulator + production manual smoke checklist and then decide whether to push Step 28B branch.
