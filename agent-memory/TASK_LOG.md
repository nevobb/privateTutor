# Task Log

## Recent tasks

### Step 28B — Firebase production mode + real user identity foundation
- Branch: `step28b-production-firebase-mode`
- Status: implemented locally (not pushed)
- Result:
  - Added explicit runtime mode separation (`emulator|production`) for client and server.
  - Added server-only `firebase-admin` integration.
  - Added production token verification path and mode-based verifier selection.
  - Migrated server repositories to admin-backed Firestore access path.
  - Added production-ready client Firebase config via `NEXT_PUBLIC_FIREBASE_*`.
  - Preserved emulator mode behavior.
  - Added identity visibility + sign-out in sidebar.
  - Added `.env.local.example` placeholders and `docs/FIREBASE_PRODUCTION_SETUP.md`.
- Notes:
  - No Step 28C/28D features implemented.
  - No push performed.

### Step 26 — Gemini embeddings provider integration
- Branch: `codex/phase26-gemini-embedding-provider`
- Status: completed on branch

### Step 25 — Semantic retrieval execution
- PR: #57
- Status: merged

### Step 24 — Embedding lifecycle boundary
- PR: #56
- Status: merged
