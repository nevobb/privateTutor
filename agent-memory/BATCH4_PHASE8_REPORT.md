# Batch 4 / Phase 8 Report — File Metadata Intake + Classify + Index Lifecycle

## Scope
Implemented Phase 8 as a server-first, metadata-only flow:
- `POST /api/workspaces/[workspaceId]/files`
- `GET /api/workspaces/[workspaceId]/files`
- deterministic topic classification + confidence
- assignment decision (`assigned` / `needs-review`)
- indexing lifecycle state transitions (`uploaded -> indexing -> indexed|failed`)
- decision-log entries for assignment/classification/indexing

Explicit non-goals in this PR:
- no binary upload
- no Firebase Storage ingestion pipeline
- no text extraction/parsing from file content
- no real chunk/vector index creation
- no retrieval execution
- no summary generation
- no learner-memory expansion

`indexingStatus` in this phase represents lifecycle state bookkeeping only.
It does **not** mean that a real searchable retrieval index was built.

## Implemented Files
- `src/app/api/workspaces/[workspaceId]/files/route.ts`
- `src/server/workspaces/uploadedFileApiSchemas.ts`
- `src/server/workspaces/uploadedFileApiService.ts`
- `src/server/workspaces/uploadedFileRepository.ts`
- `src/server/workspaces/workspaceTypes.ts`
- `src/types/index.ts`

## Inputs / Outputs Observed
### POST input (example)
```json
{
  "fileName": "Mechanics Intro.pdf",
  "sourceType": "pdf",
  "topicHint": "Mechanics"
}
```

### POST output (shape)
- `id`, `userId`, `workspaceId`
- `fileName`, `sourceType`, `storagePath?`
- `topic`, `confidence`
- `assignmentStatus`
- `indexingStatus`
- `uploadedAt`, `createdAt`, `updatedAt`

### Decision log output
For successful POST, entries are written with:
- `decisionType: file_assignment`
- `decisionType: topic_classification`
- `decisionType: file_indexing`

## Validation Matrix
- `401` unauthenticated: **PASS**
- `404` workspace not found/cross-user: **PASS**
- `400` invalid payload / unsupported `sourceType`: **PASS**
- `201` success for valid `pdf`/`docx`: **PASS**
- Metadata written under correct user/workspace: **PASS**
- Confidence-to-assignment mapping (`assigned` vs `needs-review`): **PASS**
- Indexing transitions persisted (`uploaded -> indexing -> indexed`): **PASS**
- Internal failure path marks `indexingStatus=failed`: **PASS**
- Decision logs for assignment/classification/indexing: **PASS**
- Regression smoke for sessions/messages/tutor routes: **PASS**

## Test Evidence
### Focused new tests
- `tests/server/workspaces/uploadedFileApiSchemas.test.ts`
- `tests/server/workspaces/uploadedFileApiService.test.ts`
- `tests/server/workspaces/workspaceFilesApiRoute.test.ts`
- `tests/server/workspaces/uploadedFileRepository.test.ts`
- Updated: `tests/firebase/workspaceApi.emulator.test.ts`

### Commands and results
- `pnpm -s vitest run tests/server/workspaces/uploadedFileApiSchemas.test.ts tests/server/workspaces/uploadedFileApiService.test.ts tests/server/workspaces/workspaceFilesApiRoute.test.ts`
  - **3 files passed, 19 tests passed**
- `FIREBASE_WORKSPACE_EMULATOR_TEST=1 FIREBASE_WORKSPACE_API_EMULATOR_TEST=1 pnpm -s vitest run tests/server/workspaces/uploadedFileRepository.test.ts tests/firebase/workspaceApi.emulator.test.ts`
  - **2 files passed, 19 tests passed**
- `pnpm -s vitest run tests/server/workspaces/sessionMessageApiService.test.ts tests/server/workspaces/sessionMessageApiRoute.test.ts tests/server/tutor/retrievalDecisionBoundary.test.ts tests/server/workspaces/decisionLogApiRoute.test.ts`
  - **4 files passed, 29 tests passed**

## Deferred to Later Phases
- Phase 9 (option A, metadata-only): summary lifecycle/state contracts only, without real content summaries
- Phase 10: retrieval execution and source citation flow
- Binary upload + storage ingestion pipeline (out of Phase 8 scope)

## Result
Batch 4 / Phase 8 acceptance criteria for metadata-first backend flow are complete.
