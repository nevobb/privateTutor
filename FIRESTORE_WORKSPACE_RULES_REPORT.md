# Firestore Workspace Rules Report

## Summary

This PR tightens Firestore Security Rules for all workspace persistence paths and adds
a matching emulator rule test suite. It is one implementation step only.

## Branch

`test/firestore-workspace-rules` — based on origin/main after PR #17 merged.

## What changed

### firestore.rules

Replaced the broad first-pass wildcard:

```
match /users/{userId}/{document=**} {
  allow read, write: if isOwner(userId);
}
```

With explicit path rules for each collection:

| Path | Operations | Field validation |
|------|-----------|-----------------|
| `users/{userId}` | read, write | owner only |
| `users/{userId}/workspaces/{workspaceId}` | read, create, update, delete | create requires `userId`, `name`, `status`; `userId` must match path |
| `.../workspaces/{workspaceId}/sessions/{sessionId}` | read, create, update, delete | create requires `userId`, `workspaceId`, `title`, `status`; both must match path |
| `.../sessions/{sessionId}/messages/{messageId}` | read, create only | create requires `userId`, `workspaceId`, `sessionId`, `role`, `content`; all must match path; update+delete denied |
| `users/{userId}/decisionLog/{entryId}` | read, create only | create requires `userId`, `decisionType`, `title`; `userId` must match path; update+delete denied |
| `users/{userId}/learnerMemory/{document}` | read, write | owner only |
| `users/{userId}/academicKnowledge/{document}` | read, write | owner only |
| `users/{userId}/uploadedFiles/{document}` | read, write | owner only |
| `users/{userId}/sessionSummaries/{document}` | read, write | owner only |
| `users/{userId}/providerSettings/{document}` | read, write | owner only |
| Everything else | denied | — |

Other subcollections (learnerMemory, academicKnowledge, uploadedFiles, sessionSummaries,
providerSettings) are enumerated explicitly rather than covered by a catch-all wildcard.
This prevents unrecognized future paths from accidentally inheriting read/write access.

### decisionLog emulator-phase policy

The ownership planning document specifies decisionLog as server-owned (client deny).
However, the current persistence implementation uses the Firebase Web SDK against the
emulator (no Firebase Admin SDK exists yet). Strict client-deny would break the existing
`workspacePersistence.emulator.test.ts` tests.

**Decision**: Allow owner create + read in the emulator phase. Deny update and delete
(entries are append-only). Document deferred production hardening.

**Production hardening path**: Move decisionLog writes to server-side code using the
Firebase Admin SDK, which bypasses client security rules. Once that boundary exists,
the decisionLog rule can be set to `allow read, write: if false` for all clients.

This is explicitly documented in both the rules file (inline comment) and
`docs/firebase/FIRESTORE_WORKSPACE_RULES.md`.

## Test suite added

`tests/firebase/workspaceFirestore.rules.test.ts` — 42 tests covering:

**Workspace (8 tests)**
- Unauthenticated create denied
- Unauthenticated read denied
- Owner create allowed (valid shape)
- Owner read allowed
- Cross-user create denied
- Cross-user read denied
- userId mismatch denied
- Missing required fields denied

**Session (9 tests)**
- Unauthenticated create denied
- Unauthenticated read denied
- Owner create allowed (valid shape)
- Owner read allowed
- Cross-user create denied
- Cross-user read denied
- userId mismatch denied
- workspaceId mismatch denied
- Missing required fields denied

**Message (10 tests)**
- Unauthenticated create denied
- Unauthenticated read denied
- Owner create allowed (valid shape)
- Owner read allowed
- Cross-user create denied
- Cross-user read denied
- userId mismatch denied
- workspaceId mismatch denied
- sessionId mismatch denied
- Missing required fields denied
- Owner update denied (append-only)
- Owner delete denied (append-only)

**DecisionLog (10 tests)**
- Unauthenticated create denied
- Unauthenticated read denied
- Owner create allowed (valid shape)
- Owner read allowed
- Cross-user create denied
- Cross-user read denied
- userId mismatch denied
- Missing required fields denied
- Owner update denied (append-only)
- Owner delete denied (append-only)

**Root / outside users (3 tests)**
- Authenticated write to root collection denied
- Authenticated read from root collection denied
- Unauthenticated root access denied

## Tests updated

`tests/firebase/firestore.rules.test.ts` — Updated workspace and decisionLog test cases
to use valid field shapes matching the tightened rules. The smoke-test suite now passes
with the new rules and tests the correct field shapes.

## Emulator and runtime behavior

- Rules tests use `FIREBASE_RULES_TEST=1` flag (skip without it)
- Workspace persistence tests (8/8) still pass with tightened rules
- Default `npx vitest run` does not require emulators
- No runtime source code changed
- No package.json changes
- No storage.rules changes

## Commands run

| Command | Result |
|---------|--------|
| `npm run build` | PASS |
| `npm run lint` | PASS |
| `npx vitest run` | PASS (41 passed, 76 skipped) |
| `npm run test:firebase:rules:emulators` | PASS (59 passed, 12 skipped) |
| `npm run test:firebase:workspace:emulators` | PASS (8/8) |
| `git diff --check` | clean |

## Scope constraints honored

- No runtime code changed (`src/*` untouched)
- No `package.json` or `package-lock.json` changes
- No `storage.rules` changes
- No Firebase cloud connection
- No env files or secrets
- No real Firebase project IDs (`demo-private-tutor` only)
- No Firebase Admin SDK
- No Storage upload, Gemini, Genkit, retrieval, learner memory, academic knowledge
- No UI wiring
- No production-readiness claims

## Next recommended step

**Workspace API boundary** — before wiring any UI, define the HTTP contract for
workspace CRUD operations (`POST /api/workspaces`, `GET /api/workspaces`, etc.)
and test it against the emulator with auth-verified userId derivation. This is
smaller and safer than full UI integration, keeps the implementation incremental,
and ensures the API surface matches the Firestore ownership model before client
state management is added.

Keep forbidden in that next step:
- Firebase cloud connection
- Real auth token verification (Admin SDK not present yet)
- Storage upload
- Gemini, Genkit, retrieval
- Learner memory or academic knowledge persistence
