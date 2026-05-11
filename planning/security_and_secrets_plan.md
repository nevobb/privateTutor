# Security and Secrets Plan

This is a planning document. It does not add environment files, secrets, Firebase config, rules, or runtime code.

## No API keys in frontend

- Frontend code must never import model, retrieval, or web-search provider secrets.
- React components must never read provider API keys.
- Browser bundles must not include provider credentials.

## No API keys in TypeScript app models

- Application-level TypeScript models may represent provider status and provider names.
- They must not include raw secret fields.
- Provider settings in Firestore must not store API keys.

## Placeholder environment variable names only

Names reserved for later planning:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `GEMINI_API_KEY`
- `GENKIT_ENV`
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_SEARCH_GROUNDING_ENABLED`

No values are committed in this PR.

## Local `.env.local` usage later

- `.env.local` may be used later for local development only.
- It must remain gitignored.
- It must not be created in this PR.
- Example values must not include real secrets.

## Deployment secret storage later

- Production secrets must live in deployment-provider secret storage.
- Firebase service account credentials must be server-side only.
- Gemini provider secrets must be server-side only.
- Secret rotation steps should be documented before production use.

## Firebase rules needed later

- Authenticated users can access only their own user document tree.
- Workspaces are scoped by `userId`.
- Decision logs are private.
- Learner Memory is private.
- Academic Knowledge is private unless explicitly shared in a later product decision.

## Firestore security rules planned later

Rules should enforce:

- user ownership
- no cross-user reads
- no frontend writes to provider secrets
- constrained writes for uploaded file metadata
- backend-owned writes for memory, decision logs, and summaries when needed

## Storage rules planned later

Rules should enforce:

- user-scoped storage paths
- PDF/DOCX MIME type checks for MVP
- size limits
- no public file access by default
- backend-mediated indexing status

## No secrets in commits

Before any future PR that touches backend configuration:

- scan for key-like values
- verify `.env*` files are not committed
- verify package docs do not include real credentials
- verify provider settings store status only
