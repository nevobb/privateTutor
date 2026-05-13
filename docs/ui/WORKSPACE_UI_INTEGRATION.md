# Workspace UI Integration

## What Changed

### UI Components

**`src/app/page.tsx`**
- Replaced static mock workspace data with API-backed workspace loading.
- Added `AuthShell` wrapper — unauthenticated users see the sign-in screen.
- Uses `useClientAuth` hook for auth state and token access.
- Loads workspaces on sign-in via `GET /api/workspaces`.
- Handles loading, error, and empty workspace states.
- Active workspace selection tracked in local component state.

**`src/components/workspaces/WorkspaceSelector.tsx`**
- Replaced static disabled select with dynamic, interactive selector.
- Accepts `WorkspaceLoadState` (loading | error | ready) as prop.
- Shows loading message, error message, or workspace select depending on state.
- Includes "+ מרחב חדש" (create workspace) button with inline form.
- Create form: name input, submit, cancel, error display.
- Preserves Hebrew RTL layout.

### New Libraries

**`src/lib/firebase/firebaseClientApp.ts`**
- Initializes Firebase client app for `demo-private-tutor`.
- Connects to Auth emulator at `http://127.0.0.1:9099`.
- Uses `demo-key` placeholder API key (no real Firebase credentials required).

**`src/lib/firebase/useClientAuth.ts`**
- React hook wrapping Firebase Auth `onAuthStateChanged`.
- Returns `ClientAuthState` (loading | signed-out | signed-in | auth-error).
- Exposes stable `getToken()` (calls `getIdToken()`), `signIn()` (Google popup), `signOut()`.

**`src/lib/workspaces/workspaceApiTypes.ts`**
- `WorkspaceListItem` — UI-facing workspace shape (no `userId` exposed to components).
- `CreateWorkspaceInput` — `{ name, description? }`.

**`src/lib/workspaces/workspaceApiClient.ts`**
- `fetchWorkspaces(authToken)` — GET /api/workspaces, returns `WorkspaceListItem[]`.
- `createWorkspace(authToken, input)` — POST /api/workspaces, returns `WorkspaceListItem`.
- `WorkspaceApiError` — typed error with `status` code.
- Safe error handling; non-OK responses throw `WorkspaceApiError` with server message.

## API Routes Used

| Method | Path | When Called |
|--------|------|-------------|
| GET | /api/workspaces | On sign-in (auth state becomes signed-in) |
| POST | /api/workspaces | On create workspace form submit |

## Auth Token Dependency

- Client obtains Firebase ID token via `user.getIdToken()`.
- Token sent as `Authorization: Bearer <token>` header.
- API routes verify the token server-side via `resolveAuthenticatedUser`.

### Known Runtime Limitation

`verifyFirebaseToken` in `src/server/auth/verifyFirebaseToken.ts` throws by default
("Firebase token verification is not configured."). At runtime this causes all
workspace API calls to return 401. The UI handles this as an error state.

Functional workspace API calls require either:
1. An emulator-compatible token verifier for local development (next prerequisite step).
2. Firebase Admin SDK connected to cloud (future production step).

## Out of Scope

- Session creation UI
- Message/transcript persistence UI
- POST /api/tutor behavior changes
- Firebase cloud connection
- Firebase Admin SDK
- Storage, Gemini, Genkit, retrieval
- Learner memory persistence
- Academic knowledge persistence

## Not Production-Ready

This is emulator-first, demo-only UI scaffolding. Not suitable for production use.
