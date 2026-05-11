# Firebase Rules Draft

This is draft documentation only. It is not a deployed rules file and should not be treated as active Firebase configuration.

## 1. Firestore rules goals

- Enforce authenticated user ownership.
- Prevent cross-user reads and writes.
- Keep Decision Log private.
- Keep Learner Memory private.
- Keep Academic Knowledge private unless Nevo later approves sharing.
- Restrict frontend writes to safe user-owned metadata.
- Reserve backend-owned writes for memory, summaries, decision logs, and indexing state.

## 2. Storage rules goals

- Store files under user-scoped paths.
- Prevent public reads by default.
- Allow only owner access.
- Enforce MVP file-type direction: digital PDF/DOCX only.
- Add size limits before upload implementation.
- Keep indexing status in Firestore metadata, not in public file paths.

## 3. User isolation

Every Firestore path and Storage path must be scoped by `userId`.

Users must not read or write another user's:

- workspaces
- uploaded file metadata
- sessions
- summaries
- learner memory
- academic knowledge
- decision logs
- files

## 4. Decision Log privacy

Decision Log entries are technical English metadata and must remain private to the owning user and trusted backend code.

## 5. Learner Memory privacy

Learner Memory stores personal learning behavior and preferences. It must be private, user-scoped, and separate from Academic Knowledge.

## 6. Academic Knowledge privacy

Academic Knowledge stores course materials, summaries, source metadata, and concepts. It must be private to the user unless a later product decision explicitly adds sharing.

## 7. Uploaded files metadata constraints

Uploaded file metadata should include safe fields only:

- workspace ID
- filename
- MIME type
- size
- assignment status
- indexing status
- storage path
- timestamps

It must not store provider secrets, service account keys, or raw file bytes.

## 8. PDF/DOCX-only Storage direction for MVP

MVP Storage rules should focus on digital PDF/DOCX uploads. OCR-heavy workflows are out of scope for MVP.

## 9. Backend-owned write areas later

Later rules should treat these as backend-owned or tightly controlled:

- learner memory writes
- academic summary writes
- decision log writes
- indexing status updates
- provider status updates

## 10. Draft status

This is draft only, not deployed.

Do not create active `firestore.rules` or `storage.rules` until a dedicated emulator scaffolding task.
