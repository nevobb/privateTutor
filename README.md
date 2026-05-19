# privateTutor

`privateTutor` is a personal adaptive academic tutor web app.

Core product principle: **Understanding before progress**.

The current codebase is a Next.js + Firebase-backed MVP foundation with strict boundaries around auth, ownership, and internal decision logging.

## Current Status

Implemented in repository:
- Firebase Auth emulator flow
- Workspace API/UI
- Session API/UI
- Session transcript persistence
- Decision Log persistence + diagnostics API/UI
- DeepSeek provider integration behind provider boundary
- Retrieval decision boundary and execution scaffolding
- Metadata-only file lifecycle (`/api/workspaces/[workspaceId]/files`)
- Metadata-only file summary lifecycle (`/api/workspaces/[workspaceId]/files/[fileId]/summary`)
- Cost-mode and work-mode guardrails in session service
- Learner-memory API/service boundary

Still mocked or intentionally not implemented:
- Real Gemini provider integration
- Genkit integration
- Real file upload and storage ingestion
- Real file content extraction/chunking/vector indexing
- Production web search provider integration
- Production Firebase deployment

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Firebase client SDK
- Vitest

## Local Setup

Requirements:
- Node.js 20+
- npm

Install:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Open:

- [http://localhost:3000](http://localhost:3000)

## Environment

Copy example file and edit local values as needed:

```bash
cp .env.local.example .env.local
```

Notes:
- Keep secrets in `.env.local` only.
- Do not commit `.env*` files with real credentials.

## Testing

Focused service tests:

```bash
npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts
```

Full Firebase rules suite:

```bash
npm run test:firebase:rules
```

Build verification:

```bash
npm run build
```

## Repository Protocol

Before implementation work in this repo, read:

1. `AGENT_TASK_PROTOCOL.md`
2. `agent-memory/PROJECT_STATE.md`
3. `agent-memory/CURRENT_TASK.md`
4. `agent-memory/DUAL_AGENT_SYNC_LOG.md`

Agent continuity is maintained in `agent-memory/*`.

## Safety Boundaries

- Do not work directly on `main`.
- Do not add cloud deployment steps in routine implementation tasks.
- Do not introduce external provider integrations outside approved phase scope.
