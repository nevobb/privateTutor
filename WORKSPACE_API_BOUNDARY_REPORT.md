# Workspace API Boundary Report

## Summary

Adds a narrow authenticated HTTP API for workspace CRUD. Three endpoints implemented.
One implementation step only — no UI, no cloud, no Storage/Gemini/Genkit/retrieval/memory.

## Branch

`feat/workspace-api-boundary` — based on origin/main after PRs #17 and #18 merged.

## Endpoints implemented

| Method | Path | Status codes | Description |
|--------|------|-------------|-------------|
| `POST` | `/api/workspaces` | 201, 400, 401, 503, 500 | Create workspace |
| `GET` | `/api/workspaces` | 200, 401, 503, 500 | List owner's workspaces |
| `GET` | `/api/workspaces/[workspaceId]` | 200, 401, 404, 503, 500 | Get single workspace |

PATCH and DELETE deferred — not needed for this step.

## Auth and userId ownership

- `userId` always derived from the verified Bearer token via `resolveAuthenticatedUser`
- Client-supplied `userId` in body is explicitly ignored by `validateCreateWorkspaceRequest`
- `validateCreateWorkspaceRequest` returns `ok: false` result type — no `userId` in the output shape
- All repository calls pass the trusted `user.userId` from auth context
- Cross-user access is denied at the repository layer (`getWorkspace` returns null if `data.userId !== userId`)

## Request validation (`workspaceApiSchemas.ts`)

| Field | Requirement |
|-------|------------|
| `name` | required, non-empty string, trimmed |
| `description` | optional string |
| `path` | optional string array |
| `parentWorkspaceId` | optional string |
| `stableIdentityNote` | optional string |
| `userId` | explicitly excluded from validated output |

## Files added

- `src/app/api/workspaces/route.ts` — GET + POST handlers (injectable auth)
- `src/app/api/workspaces/[workspaceId]/route.ts` — GET by ID handler
- `src/server/workspaces/workspaceApiSchemas.ts` — validation + response mapping
- `src/server/workspaces/workspaceApiService.ts` — service layer over repositories
- `tests/server/workspaces/workspaceApiSchemas.test.ts` — 14 unit tests
- `tests/server/workspaces/workspaceApiService.test.ts` — 10 unit tests
- `tests/server/workspaces/workspaceApiRoute.test.ts` — 17 unit tests (mocked service)
- `tests/firebase/workspaceApi.emulator.test.ts` — 7 emulator integration tests
- `docs/firebase/WORKSPACE_API_BOUNDARY.md` — endpoint docs
- `planning/workspace_api_boundary_report_draft.md` — planning draft
- `WORKSPACE_API_BOUNDARY_REPORT.md` — this file

## Files changed

- `src/server/workspaces/workspaceRepository.ts` — added `listWorkspaces(userId)` function
- `PROJECT_STATE.md` — updated
- `NEXT_STEPS_FOR_NEVO.md` — updated

## Test summary

| Suite | Count | Gate |
|-------|-------|------|
| `workspaceApiSchemas.test.ts` | 14 passed | default `npx vitest run` |
| `workspaceApiService.test.ts` | 10 passed | default `npx vitest run` |
| `workspaceApiRoute.test.ts` | 17 passed | default `npx vitest run` |
| `workspaceApi.emulator.test.ts` | 7 passed | `FIREBASE_WORKSPACE_API_EMULATOR_TEST=1` |
| workspace persistence emulator | 8 passed | `FIREBASE_WORKSPACE_EMULATOR_TEST=1` |
| Firestore rules emulator | 59 passed | `FIREBASE_RULES_TEST=1` |
| Default `npx vitest run` | 83 passed, 83 skipped | no emulators |

## Reviewer findings

**Security (Reviewer F)**
- No client userId trust: validation output type has no userId field, repository calls use `user.userId`
- No cross-user risk: `getWorkspace` checks `data.userId !== userId` and returns null
- Error responses use generic messages, no stack traces or internal paths leaked
- No Firebase cloud fallback: `withFirestoreEmulatorClient` throws `FirestoreEmulatorUnavailableError` → 503
- All routes require auth before any repository call
- `getWorkspaceForUser` scopes by `user.userId` — no path-only access without ownership check
- No UI, Storage, Gemini, Genkit, retrieval, or memory scope creep

**Integration (Reviewer G)**
- `npx vitest run` passes without emulators (83 passed, 83 skipped)
- No package.json changes
- `POST /api/tutor` behavior unchanged
- Workspace persistence emulator tests: 8/8
- Firestore rules tests: 59/59

## Commands run

| Command | Result |
|---------|--------|
| `npm run build` | PASS (routes appear: /api/workspaces, /api/workspaces/[workspaceId]) |
| `npm run lint` | PASS (0 errors, 4 warnings about `_req` naming — acceptable) |
| `npx vitest run` | PASS (83 passed, 83 skipped) |
| `npm run test:firebase:workspace:emulators` | PASS (8/8) |
| `npm run test:firebase:rules:emulators` | PASS (59/59) |
| workspace API emulator (manual) | PASS (7/7) |
| `git diff --check` | clean |

## Scope constraints honored

- No Firebase cloud connection
- No env files or secrets
- No real Firebase project IDs (`demo-private-tutor` only)
- No Firebase Admin SDK
- No Storage, Gemini, Genkit, retrieval, learner memory, academic knowledge
- No UI changes
- No tutor provider changes
- No firestore.rules changes
- No storage.rules changes
- No package.json or package-lock.json changes
- Default tests emulator-independent

## Next recommended task

**UI workspace integration** — wire the workspace list panel and workspace creation
to `GET /api/workspaces` and `POST /api/workspaces`. Smallest safe UI slice: replace
static mock workspace data with real API fetch, add creation flow. Keep session/message
UI and tutor provider unchanged. Keep Firebase cloud disconnected.
