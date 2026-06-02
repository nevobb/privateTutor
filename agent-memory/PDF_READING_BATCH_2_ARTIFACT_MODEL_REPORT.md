# PDF Reading Batch 2 — Artifact Model Report

## Branch name
- `repair/pdf-document-artifacts-model`

## Working tree status
- Started from a clean working tree.
- After implementation, the working tree contains only Batch 2 artifact-model files plus this report and the required sync-log update.

## Existing structure
- Uploaded files are stored at `users/{userId}/uploadedFiles/{fileId}` via `src/server/workspaces/uploadedFileRepository.ts`.
- Workspaces, sessions, and messages use separate nested paths under `users/{userId}/workspaces/...`.
- File chunks already use a workspace/file-specific path, but uploaded-file metadata remains the app-owned file root.
- That makes the uploaded-file document the safest ownership root for future understanding artifacts in this batch.

## Chosen artifact paths
- Pages: `users/{userId}/uploadedFiles/{fileId}/pages/{pageId}`
- Outline: `users/{userId}/uploadedFiles/{fileId}/documentOutline/{outlineId}`
- Detected questions: `users/{userId}/uploadedFiles/{fileId}/detectedQuestions/{questionId}`

## Implementation
- Added additive domain artifact types in `src/types/index.ts`:
  - `DocumentSourceReference`
  - `DocumentPageArtifact`
  - `DocumentOutlineSection`
  - `DocumentOutlineArtifact`
  - `DetectedQuestionSubsection`
  - `DetectedQuestionArtifact`
  - `DocumentTextQuality`
  - `DocumentOutlineConfidence`
- Added server record types in `src/server/workspaces/workspaceTypes.ts`:
  - `DocumentSourceReferenceRecord`
  - `DocumentPageArtifactRecord`
  - `DocumentOutlineArtifactRecord`
  - `DetectedQuestionArtifactRecord`
- Added schema/serialization helpers in `src/server/workspaces/documentArtifactSchemas.ts` for:
  - parsing page artifacts
  - parsing outline artifacts
  - parsing detected-question artifacts
  - parsing source references
  - serializing the three persisted artifact record shapes
- Added repository/storage support in `src/server/workspaces/documentArtifactRepository.ts`:
  - `replaceDocumentPages()`
  - `listDocumentPages()`
  - `saveDocumentOutline()`
  - `getDocumentOutline()`
  - `replaceDetectedQuestions()`
  - `listDetectedQuestions()`
  - path helpers for the three subcollections
- No tutor runtime behavior was changed.
- No inventory behavior was changed.
- No provider logic was added.

## Tests added/updated
- Added `tests/server/workspaces/documentArtifactSchemas.test.ts`
  - validates each artifact shape
  - validates nested outline sections
  - validates detected-question subsections
  - validates source-reference parsing
  - rejects invalid enum/shape cases
- Added `tests/server/workspaces/documentArtifactRepository.test.ts`
  - creates/lists pages
  - saves/reads document outline
  - creates/lists detected questions
  - returns empty/null safely when artifacts are absent
  - confirms uploaded-file metadata remains readable and unaffected

## Backward compatibility behavior
- Old uploaded-file records remain readable because no uploaded-file path or existing file metadata behavior changed.
- Missing artifact subcollections safely return `[]` or `null`.
- This batch does not require migration and does not backfill old files.
- Artifact ownership is additive and isolated under the existing uploaded-file document.

## Validation results
- `npx tsc --noEmit` ✅
- `npx vitest run` ✅ (`60` files passed, `18` skipped; `603` tests passed, `121` skipped)
- `npm run build` ✅
- `git diff --check` ✅
- `graphify update .` ✅

## Not implemented
- No Gemini runtime
- No Deep PDF mode behavior
- No page-image rendering
- No OCR
- No tutor/runtime routing changes
- No UI changes
- No provider boundary changes
- No Firestore path decisions beyond these additive subcollections

## Risks / open decisions
- The new artifact paths are compatible with the current ownership model, but future runtime use should still verify whether page-aware retrieval should read only from uploaded-file subcollections or coordinate with workspace/file chunk paths.
- `documentOutline` is currently modeled as a subcollection with a singleton document (`v1`), which is safe now but should remain explicit in future provider/orchestration work.
- This batch stores structure only; future batches still need quality gates and provider orchestration before any tutor behavior changes.

## Safety
- No source behavior outside Batch 2 was changed.
- I did not run `git add`.
- I did not commit.
- I did not push.
- I did not run `git pull`.
