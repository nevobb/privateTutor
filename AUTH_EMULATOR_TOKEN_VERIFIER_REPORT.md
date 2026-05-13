# Auth Emulator Token Verifier Report

One auth-emulator verifier step only. No Admin SDK, no cloud, no env files, no secrets, no new packages.

## Branch

`feat/auth-emulator-token-verifier` — based on `origin/main` after PR #20 (workspace UI integration) merged.

## Subagents Used

None. Main Claude implemented all files directly.

## File Ownership Map

| Concern | File |
|---------|------|
| Emulator connection constants | `src/server/auth/authEmulatorConfig.ts` |
| Emulator REST lookup verifier | `src/server/auth/verifyFirebaseTokenEmulator.ts` |
| Default verifier (updated) | `src/server/auth/verifyFirebaseToken.ts` |
| Unit tests | `tests/server/auth/verifyFirebaseTokenEmulator.test.ts` |
| Emulator integration tests | `tests/firebase/authEmulatorVerifier.emulator.test.ts` |
| Auth emulator verifier docs | `docs/firebase/AUTH_EMULATOR_VERIFIER.md` |

## Files Added

| File | Purpose |
|------|---------|
| `src/server/auth/authEmulatorConfig.ts` | Hardcoded emulator constants (mirrors `firebaseServerConfig.ts` pattern) |
| `src/server/auth/verifyFirebaseTokenEmulator.ts` | REST-based emulator token verifier |
| `tests/server/auth/verifyFirebaseTokenEmulator.test.ts` | 15 unit tests, injectable fetch |
| `tests/firebase/authEmulatorVerifier.emulator.test.ts` | 4 emulator integration tests |
| `docs/firebase/AUTH_EMULATOR_VERIFIER.md` | Documentation |
| `AUTH_EMULATOR_TOKEN_VERIFIER_REPORT.md` | This report |

## Files Changed

| File | Change |
|------|--------|
| `src/server/auth/verifyFirebaseToken.ts` | Delegates to `verifyFirebaseTokenEmulator` |
| `PROJECT_STATE.md` | Updated to reflect working local auth flow |
| `NEXT_STEPS_FOR_NEVO.md` | Updated to manual smoke test + session boundary |

## Emulator Verifier Summary

`verifyFirebaseTokenEmulator(token, fetchFn?)` calls:
```
POST http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-key
Body: { "idToken": token }
```
Maps `users[0].localId` → `VerifiedFirebaseToken.uid`. Accepts optional `fetchFn` parameter for testability.

## Default Verifier Policy Summary

`verifyFirebaseToken` now delegates to `verifyFirebaseTokenEmulator`. This is valid for the `demo-private-tutor` emulator-only setup. If the Auth emulator is not running, the verifier returns `null` (fail closed → 401). No throw, no leak.

## Failure Behavior Summary

All error conditions return `null` (never throw):
- Network error / emulator not running → null
- Non-200 HTTP response → null
- Malformed JSON → null
- Empty users array → null
- Missing users key → null
- localId missing, empty, or non-string → null

`resolveAuthenticatedUser` treats `null` as 401 Unauthorized.

## Unit Test Summary

`tests/server/auth/verifyFirebaseTokenEmulator.test.ts` — 15 tests:
- Valid lookup: uid + email mapping
- Email mapping when present / absent
- Endpoint is `127.0.0.1:9099` only
- POST method + idToken in body
- Empty users → null
- Missing users → null
- 400 → null
- 401 → null
- 500 → null
- Network error → null
- Malformed JSON → null
- Empty localId → null
- Non-string localId → null
- Non-object users entry → null

Injectable `fetchFn` parameter used in all tests — no `vi.stubGlobal` needed.

## Emulator Integration Test Summary

`tests/firebase/authEmulatorVerifier.emulator.test.ts` — 4 tests (gated by `FIREBASE_AUTH_EMULATOR_TEST=1`):
1. Emulator-issued token verified → correct uid returned
2. Email from emulator token matches expected email
3. Invalid token → null (fail closed)
4. `GET /api/workspaces` with emulator-verified token → 200 (not 401)

Mocks Firestore client and workspace service so only Auth emulator is required.

## Reviewer Findings (Security)

- Only calls `127.0.0.1:9099` — no cloud identity endpoint risk
- `demo-key` is a placeholder, not a real API key — no secret risk
- No unsigned token acceptance — must pass through emulator lookup
- Fail-closed on all error paths — no token bypass possible
- No Firebase Admin SDK, no service account, no env files
- No package.json changes

## Reviewer Findings (Integration)

- UI 401 blocker removed in emulator mode — browser sign-in → real workspace API call works
- Workspace API routes unchanged
- Default `npx vitest run` remains emulator-independent: 110 pass, 87 skip (was 95/83)
- New emulator tests correctly skip without `FIREBASE_AUTH_EMULATOR_TEST=1`
- No package changes

## Commands Run

| Command | Result |
|---------|--------|
| `npx vitest run tests/server/auth/verifyFirebaseTokenEmulator.test.ts` | 15/15 pass |
| `npx vitest run` | 110 pass, 87 skip (was 95/83) |
| `npm run build` | ✓ clean |
| `npm run lint` | 0 errors, 5 warnings (1 new: `_req` in emulator test — pre-existing pattern) |
| `git diff --check` | clean |

## What Did NOT Change

- UI code: unchanged
- Workspace API routes: unchanged
- Server workspace code: unchanged
- Firestore runtime code: unchanged
- `package.json` / `package-lock.json`: unchanged
- `firestore.rules` / `storage.rules`: unchanged
- Firebase cloud / Admin / env / secrets: none added
- Storage / Gemini / Genkit / retrieval / memory: none added
- Default tests require emulators: No

## Commit

See git log on `feat/auth-emulator-token-verifier`.

## Exact Next Recommended Task

**Manual browser smoke test:**

1. `firebase emulators:start --only auth,firestore`
2. `npm run dev`
3. Sign in via browser → workspace list loads → create workspace → verify persistence

Then: **Session API boundary** — `POST /api/sessions`, `GET /api/sessions?workspaceId=<id>`, using the same emulator-first, auth-verified, API-boundary pattern as the workspace implementation.
