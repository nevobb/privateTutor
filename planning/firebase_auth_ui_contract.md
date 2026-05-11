# Firebase Auth UI Contract

## Purpose

Define the future auth UI boundary only.

This contract does not connect Firebase Auth runtime and does not redesign the app.

Auth must protect user-scoped data without turning the tutor into a login-first SaaS dashboard.

## Minimal auth UI contract

The future implementation should add an `AuthShell` above the main tutor workspace.

`AuthShell` owns:

- `loading`;
- `signedOut`;
- `signedIn`;
- `authError`.

`AuthShell` passes only stable session facts into tutor UI:

- `userId`;
- `displayName`;
- `authProvider`;
- `isAuthenticated`.

Tutor components should not import Firebase Auth directly.

## Auth states

`loading`:

- show a quiet Hebrew RTL loading state;
- do not show the tutor workspace with fake authenticated data.

`signedOut`:

- show a minimal sign-in surface;
- allow Temporary Chat only if it remains explicitly ephemeral.

`signedIn`:

- render the normal tutor workspace;
- expose authenticated identity to later profile/workspace bootstrap work.

`authError`:

- show a concise Hebrew error;
- offer retry or sign-out action.

## MVP provider recommendation

Use Google Sign-In only for MVP unless Nevo explicitly requests another provider.

Rationale:

- lowest friction for a personal academic tool;
- native Firebase support;
- avoids password reset and account-management surface area.

Do not build email/password, provider linking, account recovery, or multi-provider account management in the first Auth boundary PR.

## Hebrew RTL considerations

Auth UI must preserve Hebrew RTL assumptions:

- use Hebrew copy;
- keep layout direction RTL;
- avoid imported LTR auth-card layouts;
- keep email/account identifiers readable even if the identifier text itself is LTR;
- avoid layout shift when auth state resolves.

Suggested button copy: `כניסה עם Google`.

## Workspace creation waits for a later data task

Workspace creation must wait for a confirmed Firebase `uid`.

The Auth boundary PR should not create, read, or write workspace records.

Future workspace bootstrap should be a separate Firestore/workspace task with its own rules and tests.

Do not create permanent workspaces while auth is loading or signed out.

Do not persist signed-out workspace drafts into Firestore.

## Temporary Chat before login

Signed-out users may use Temporary Chat only as an ephemeral mode.

Temporary Chat before login must not:

- write Firestore data;
- upload to Storage;
- create learner memory;
- create academic knowledge;
- create workspaces;
- auto-migrate into permanent history after login.

A future manual copy/import affordance can be planned later, but MVP should not auto-import signed-out chats.

## UI not to implement yet

Do not implement:

- account settings page;
- profile editor;
- password login/reset UI;
- provider linking;
- billing, team, sharing, invite, or organization UI;
- full landing page;
- Firebase console/config screen;
- raw API keys or Firebase config display.

## Boundary between auth shell and tutor UI

`AuthShell` responsibilities:

- initialize Firebase Auth later;
- subscribe to auth state;
- show loading/signed-out/signed-in branches;
- pass authenticated identity downward;
- expose a clear hook for later profile/workspace bootstrap without implementing it.

Tutor UI responsibilities:

- render workspace, files, modes, memory indicators, and conversation;
- assume authenticated data is already scoped to current user;
- support Temporary Chat as no-persistence mode.

Forbidden boundary crossing:

- tutor components should not call Firebase sign-in/sign-out directly except through callbacks;
- tutor components should not decide auth provider logic;
- auth shell should not contain tutor behavior, retrieval logic, memory logic, or workspace business rules.
