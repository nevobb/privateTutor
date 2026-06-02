# PDF Reading Batch 1 Data Model Report

## 1. Branch name
- `diagnostic/pdf-reading-provider-evaluation`

## 2. Working tree status
- `git status --short` was clean before implementation began.
- After this task, the working tree contains only the Batch 1 code/test changes plus this report file.

## 3. Files changed
- `src/types/index.ts`
- `src/server/workspaces/workspaceTypes.ts`
- `src/server/workspaces/uploadedFileApiSchemas.ts`
- `src/server/workspaces/uploadedFileRepository.ts`
- `src/server/workspaces/uploadedFileApiService.ts`
- `tests/server/workspaces/uploadedFileApiSchemas.test.ts`
- `tests/server/workspaces/uploadedFileRepository.test.ts`
- `tests/server/workspaces/uploadedFileApiService.test.ts`
- `agent-memory/PDF_READING_BATCH_1_DATA_MODEL_REPORT.md`

## 4. Fields added
Added additive uploaded-file metadata for future document understanding:
- `understandingStatus: "not_started" | "pending" | "completed" | "failed"`
- `understandingErrorCode?: string | null`
- `understandingUpdatedAt?: Date | null`
- `pageCount?: number`
- `outlineTitle?: string`
- `detectedQuestionCount?: number`
- `extractionQuality?: "good" | "partial" | "poor"`
- `deepPdfStatus?: "not_started" | "recommended" | "pending" | "completed" | "failed" | "skipped"`
- `deepPdfUpdatedAt?: Date | null`

## 5. Defaults and backward compatibility behavior
### New records
New uploaded-file records now receive explicit lifecycle defaults only where appropriate:
- `understandingStatus: "not_started"`
- `understandingErrorCode: null`
- `understandingUpdatedAt: null`
- `pageCount: undefined`
- `outlineTitle: undefined`
- `detectedQuestionCount: undefined`
- `extractionQuality: undefined`
- `deepPdfStatus: "not_started"`
- `deepPdfUpdatedAt: null`

### Old records
- Legacy Firestore records that do not contain the new fields remain readable.
- Missing `understandingStatus` maps safely to `undefined` at read time.
- Missing `deepPdfStatus` maps safely to `undefined` at read time.
- No migration was added or required.

### Behavior boundary
- No tutor runtime behavior changed.
- No extraction/chunking/embedding logic changed.
- No page/document artifact collections were added.
- No Gemini runtime, Deep PDF mode, OCR, vision, or UI changes were introduced.

## 6. Schema / repository / service layer changes
### Public/domain types
- Extended uploaded-file domain types with the new metadata/status fields.
- Added status unions for document-understanding and Deep PDF lifecycle states.

### Server record/input types
- Extended `CreateUploadedFileInput` and related record types so repository creation and updates can carry the new fields.

### API schema preservation
- Extended uploaded-file API response serialization to preserve the new metadata fields.
- Added a small uploaded-file response validation helper for enum-field compatibility tests.
- Create-request parsing remains backward compatible and does not require the new fields.

### Repository mapping
- Added tolerant Firestore mapping for the new metadata fields.
- Legacy records with missing fields continue to deserialize without crashing.
- Date-like fields use the existing `toDate` mapping behavior.

### Service defaults
- `createFileForWorkspace(...)` now initializes the new lifecycle fields for newly created uploaded-file records.
- No other lifecycle behavior changed.

## 7. Tests added/updated
### `tests/server/workspaces/uploadedFileApiSchemas.test.ts`
- verifies response serialization includes new metadata fields
- verifies legacy uploaded-file response objects without the new fields still validate
- verifies invalid enum values are rejected for:
  - `understandingStatus`
  - `extractionQuality`
  - `deepPdfStatus`

### `tests/server/workspaces/uploadedFileRepository.test.ts`
- verifies legacy records without the new fields still load safely
- verifies missing `understandingStatus` / `deepPdfStatus` remain non-crashing legacy reads
- verifies new metadata fields round-trip through create/update/load repository flows
- verifies new date fields map correctly through `toDate`

### `tests/server/workspaces/uploadedFileApiService.test.ts`
- verifies newly created uploaded files receive the new Batch 1 defaults
- verifies no existing indexing/extraction/chunking defaults regressed

## 8. Validation results
### Focused tests
- `npx vitest run tests/server/workspaces/uploadedFileApiSchemas.test.ts` — passed (`10` tests)
- `npx vitest run tests/server/workspaces/uploadedFileRepository.test.ts` — passed (`1` file passed, `6` skipped in emulator-scoped suite)
- `npx vitest run tests/server/workspaces/uploadedFileApiService.test.ts` — passed (`15` tests)

### Required validation
- `npx tsc --noEmit` — passed
- `npx vitest run` — passed (`59` files passed, `17` skipped; `598` tests passed, `117` skipped)
- `npm run build` — passed
- `git diff --check` — passed
- `graphify update .` — passed

## 9. Scope explicitly not implemented
- no page collections
- no `documentOutline`
- no `detectedQuestions`
- no Firestore artifact paths for future document artifacts
- no Gemini runtime
- no Deep PDF mode behavior
- no tutor runtime changes
- no UI changes
- no OCR / Vision / CAS
- no new dependencies

## 10. Confirmation that no source code outside Batch 1 scope was edited
Confirmed.

Only Batch 1 additive metadata surfaces, related tests, and this report were changed.

## 11. Confirmation that no git add / commit / push was run
Confirmed:
- No `git add`
- No `git commit`
- No `git push`

## 12. Confirmation that no git pull was run
Confirmed:
- No `git pull`
