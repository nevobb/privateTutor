# Tutor File Inventory Classifier Repair Report

## 1. Branch name

- `audit/post-repair-recovery-audit`

## 2. Root cause

- The Hebrew smoke-test question `איזה קבצים העליתי לסביבת העבודה הזאת ומה יש בהם?` was classified as `general_tutor_question` instead of `file_content_inventory`.
- Because of that misclassification, `src/server/workspaces/sessionMessageApiService.ts` skipped the local inventory shortcut and fell through to the model/provider path.
- In that wrong path, `listUploadedFiles(...)`, `listFileChunks(...)`, and `buildFileInventory(...)` were not reached for the uploaded-file inventory question.

## 3. Files changed

- `src/server/tutor/requestClassifier.ts`
- `tests/server/tutor/requestClassifier.test.ts`
- `tests/server/workspaces/sessionMessageApiService.test.ts`

## 4. Exact classifier patterns added

Added to `FILE_CONTENT_INVENTORY_PATTERNS` in `src/server/tutor/requestClassifier.ts`:

- `/(?:איזה|אילו)\s+קבצים\s+(?:העליתי|יש לי)(?:\s+בסביבת העבודה(?:\s+הזאת)?)?/i`
- `/מה\s+יש\s+בקבצים\s+שהעליתי/i`
- `/תראה לי את הקבצים שהעליתי/i`
- `/תגיד לי\s+(?:איזה|אילו)\s+קבצים\s+העליתי(?:\s+ומה\s+(?:יש\s+בהם|התוכן\s+שלהם))?/i`

Also updated the returned `reason` string for `file_content_inventory` to reflect uploaded-file inventory phrasing in addition to question/exercise enumeration.

## 5. Why the fix is narrow enough

- The new patterns are anchored to uploaded/workspace-file inventory phrasing, not generic mentions of “file” or “content”.
- They specifically require signals like:
  - `קבצים`
  - `העליתי`
  - `יש לי בסביבת העבודה`
  - `הקבצים שהעליתי`
- This avoids broadening classification for unrelated theory questions, generic content questions, or summary requests.
- Existing routing for:
  - `file_access_status`
  - `file_summary_request`
  - `specific_file_question`
  - `general_tutor_question`
  remains unchanged.

## 6. Tests added/updated

### `tests/server/tutor/requestClassifier.test.ts`

Added positive classifier coverage for:

- `איזה קבצים העליתי לסביבת העבודה הזאת ומה יש בהם?`
- `איזה קבצים העליתי?`
- `אילו קבצים העליתי?`
- `איזה קבצים יש לי בסביבת העבודה?`
- `מה יש בקבצים שהעליתי?`
- `תראה לי את הקבצים שהעליתי`
- `תגיד לי איזה קבצים העליתי ומה התוכן שלהם`

Added a negative guard:

- `איך מסבירים תוכן של קובץ טוב יותר?` stays `general_tutor_question`

### `tests/server/workspaces/sessionMessageApiService.test.ts`

Added service-level proof that uploaded-file inventory phrasing:

- reaches the local inventory response path
- bypasses `getMockTutorResponse`
- calls `listUploadedFiles(...)`
- calls `listFileChunks(...)` when a ready file exists
- returns inventory-style content instead of “no direct access”

Added branch coverage for uploaded-file inventory phrasing when:

- files exist but are still processing
- no uploaded files exist

### Route-level coverage

- No new route test was added.
- Reason: the active route test already proves `/api/sessions/[sessionId]/messages` forwards parsed POST input to `sessionMessageApiService`.
- The repaired behavior is classifier- and service-local, so additional route mocking would add noise without increasing confidence much.

## 7. Validation commands and results

### Focused tests

- `npx vitest run tests/server/tutor/requestClassifier.test.ts`
  - Passed
- `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts`
  - Passed
- `npx vitest run tests/behavior/mvpFileLearningPipeline.test.ts`
  - Passed

### Required project validation

- `npx tsc --noEmit`
  - Passed
- `npx vitest run`
  - Passed
  - Summary: `59` passed, `17` skipped; `586` tests passed, `116` skipped
- `npm run build`
  - Passed
- `git diff --check`
  - Passed

### Graphify refresh

- `graphify update .`
  - Passed

## 8. What was intentionally not fixed

- Retrieval design was not changed
- Upload/processing pipeline was not redesigned
- `FilePanel` was not modified
- Model/provider behavior was not modified
- Session routing was not modified
- Inventory formatting was not expanded to include filenames in the rendered inventory response
- Multi-file inventory behavior was not redesigned

## 9. Remaining risks

- `buildFileInventory(...)` still summarizes only the first ready file chosen by the service branch
- Inventory formatting still depends on extracted headings and may be sparse for prose-only documents
- Additional Hebrew phrasings may still appear over time and need classifier expansion if users phrase requests differently
- This repair fixes branch selection for uploaded-file inventory prompts; it does not change deeper retrieval behavior for specific file questions or summaries

## 10. Confirmation that no git add / commit / push was run

- No `git add`
- No `git commit`
- No `git push`
- No `git pull`
