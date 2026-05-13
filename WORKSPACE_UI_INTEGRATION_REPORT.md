# Workspace UI Integration Report

One UI integration step only. No cloud, no Admin SDK, no Storage/Gemini/Genkit/retrieval/memory.

## Branch

`feat/ui-workspace-integration` — based on `origin/main` after PRs #17, #18, #19 merged.

## Subagents Used

- **cavecrew-builder (Writer A)**: Created `src/lib/workspaces/workspaceApiTypes.ts` and `src/lib/workspaces/workspaceApiClient.ts`.
- **cavecrew-builder (Writer B)**: Created `src/lib/firebase/firebaseClientApp.ts` and `src/lib/firebase/useClientAuth.ts`.
- **Main Claude**: UI integration (WorkspaceSelector, page.tsx), tests, docs, project state updates.

## Workspace UI Ownership Map

| Concern | File |
|---------|------|
| Workspace list rendering | `src/components/workspaces/WorkspaceSelector.tsx` |
| Active workspace state | `src/app/page.tsx` (local state) |
| Workspace creation UI | `src/components/workspaces/WorkspaceSelector.tsx` |
| Mock workspace data (replaced) | `src/mock/data.ts` (no longer imported for workspace) |

## Files Added

| File | Purpose |
|------|---------|
| `src/lib/firebase/firebaseClientApp.ts` | Firebase client app init, Auth emulator connection |
| `src/lib/firebase/useClientAuth.ts` | React hook: auth state, getToken, signIn, signOut |
| `src/lib/workspaces/workspaceApiTypes.ts` | UI-facing workspace types (WorkspaceListItem, CreateWorkspaceInput) |
| `src/lib/workspaces/workspaceApiClient.ts` | fetchWorkspaces, createWorkspace, WorkspaceApiError |
| `tests/lib/workspaces/workspaceApiClient.test.ts` | 12 unit tests for API client |
| `docs/ui/WORKSPACE_UI_INTEGRATION.md` | Integration documentation |

## Files Changed

| File | Change |
|------|--------|
| `src/app/page.tsx` | AuthShell wrap, useClientAuth hook, API-backed workspace loading |
| `src/components/workspaces/WorkspaceSelector.tsx` | Dynamic state-driven rendering, create workspace form |
| `PROJECT_STATE.md` | Updated to reflect UI integration and 401 runtime limitation |
| `NEXT_STEPS_FOR_NEVO.md` | Updated to emulator token verifier as next step |

## Workspace API Client Summary

- `fetchWorkspaces(authToken)` — GET /api/workspaces, returns `WorkspaceListItem[]`
- `createWorkspace(authToken, input)` — POST /api/workspaces, returns `WorkspaceListItem`
- `WorkspaceApiError` — typed error with `status` code
- Non-OK responses parsed for server error message; fallback to Hebrew default
- No Firebase dependency in client helper — pure fetch

## UI Integration Summary

- `page.tsx` loads workspaces on `authState.status === "signed-in"` transition
- `WorkspaceSelector` receives `WorkspaceLoadState` prop (loading | error | ready)
- Create workspace inline form: name input, submit, cancel, creating state, error display
- Active workspace tracked in local state; first workspace auto-selected on load
- Hebrew RTL layout preserved throughout
- Mock tutor, files, memory panels unchanged

## Auth / Token Handling Summary

- Firebase Auth client SDK (`firebase/auth`) already in package.json — no new packages
- `firebaseClientApp.ts` uses `demo-key` placeholder and connects Auth emulator on port 9099
- `useClientAuth` hook provides stable `getToken()` via `useRef` to avoid stale closures
- `getToken()` calls `user.getIdToken()` on the current Firebase User
- Token passed explicitly as `authToken` parameter — no global state, no env secrets

## Known Runtime Limitation (401)

`src/server/auth/verifyFirebaseToken.ts` throws by default. The server rejects all
Bearer tokens with 401. The UI handles this as an error state (displays error message).

Functional API calls require the **next step**: implement an emulator-compatible
token verifier using the Auth emulator REST endpoint (no Admin SDK needed).

## Loading / Error / Empty State Summary

| State | WorkspaceSelector displays |
|-------|---------------------------|
| loading | "טוען מרחבים..." |
| error | Error message from API or default Hebrew fallback |
| ready + empty | "אין מרחבים" + create button |
| ready + workspaces | Select dropdown + create button |

## Tests Summary

- `tests/lib/workspaces/workspaceApiClient.test.ts` — 12 tests
  - fetchWorkspaces: success, auth header, empty, 401, 503 with message, 500 fallback
  - createWorkspace: success, body sent, headers, 400, 401, unparseable error fallback
- All tests use `vi.stubGlobal("fetch", ...)` — no emulators, no Firebase
- Total test suite: 95 passed | 83 skipped (emulator only) — was 83 | 83

## Reviewer Findings (Security / Auth)

- No fake auth headers in runtime UI — token comes from real Firebase Auth SDK
- `userId` is never client-supplied — always derived from verified token on server
- No env files, secrets, API keys, service account JSON added
- `demo-key` is the standard Firebase demo project placeholder — not a secret
- Auth emulator URL (`http://127.0.0.1:9099`) is hardcoded as emulator-only config

## Reviewer Findings (Integration / UI)

- `npx vitest run` passes without emulators (95 passed, 83 skipped)
- Hebrew RTL preserved — all new UI text in Hebrew, `dir="rtl"` on selector
- Workspace API boundary used — no direct Firestore access from UI
- Build passes: `npm run build` clean, TypeScript no errors
- Lint: 0 errors, 4 pre-existing warnings in unmodified files

## Commands Run

| Command | Result |
|---------|--------|
| `npx vitest run tests/lib/workspaces/workspaceApiClient.test.ts` | 12/12 pass |
| `npx vitest run` | 95 pass, 83 skip (was 83/83) |
| `npm run build` | ✓ clean |
| `npm run lint` | 0 errors, 4 pre-existing warnings |
| `git diff --check` | clean |

## What Did NOT Change

- Runtime API routes: unchanged
- Server workspace code: unchanged
- `package.json` / `package-lock.json`: unchanged
- `firestore.rules` / `storage.rules`: unchanged
- Firebase cloud / Admin / env / secrets: none added
- Storage / Gemini / Genkit / retrieval / memory: none added
- POST /api/tutor behavior: unchanged
- Session / message UI: unchanged
- Emulator tests: still skip without emulators

## Commit

See git log on `feat/ui-workspace-integration`.

## Exact Next Recommended Task

**Step 32 — Emulator-compatible token verifier**

Implement `src/server/auth/verifyFirebaseTokenEmulator.ts` that verifies Firebase Auth
emulator tokens via the emulator REST endpoint (no Admin SDK). Wire it as the default
verifier for `demo-private-tutor` projects. Unit tests + emulator integration test.
This unblocks end-to-end: browser sign-in → real workspace API call → workspace list loads.
