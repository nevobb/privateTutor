# PDF Reading Batch 6C.2 — Inventory Smoke Failure Fix Report

## Branch
- `repair/artifact-aware-file-inventory`

## Root cause
There were really two issues in the inventory path:

1. The real leak path was the chunk fallback formatter.
   - `sessionMessageApiService.ts` first tries `maybeBuildArtifactAwareInventoryContent(...)`
   - when that returns `null`, runtime falls back to `buildFileInventory(...)` + `formatFileInventoryResponse(...)`
   - that fallback path still leaked weak snippets like `א ת השטף המגנטי`, `פרמטרים,,, a b R I`, and duplicate low-quality `מקטע ג׳`

2. Even after the leak was fixed, the user-facing wording still sounded like a processing report instead of a tutor reply.
   - phrases like `הקובץ זוהה והטקסט חולץ`
   - `אני עובד עם הטקסט שחולץ`
   - `מקטעים שזוהו חלקית`

## Runtime path traced
### Artifact-aware path
- `src/server/workspaces/sessionMessageApiService.ts`
  - `file_content_inventory` first calls `maybeBuildArtifactAwareInventoryContent(...)`
- that path uses `buildArtifactAwareFileInventory(...)` + `formatArtifactAwareFileInventoryResponse(...)`

### Chunk fallback path
- when artifact-aware inventory returns `null`, runtime falls back to:
  - `listFileChunks(...)`
  - `buildFileInventory(...)`
  - `formatFileInventoryResponse(...)`
- this fallback path was the actual source of the smoke-leak snippets

## Files changed
- `src/server/tutor/fileInventoryService.ts`
- `tests/server/tutor/fileInventoryService.test.ts`
- `tests/server/workspaces/sessionMessageApiService.test.ts`
- `tests/behavior/mvpFileLearningPipeline.test.ts`
- `agent-memory/PDF_READING_BATCH_6C2_INVENTORY_SMOKE_FAILURE_FIX_REPORT.md`
- `agent-memory/DUAL_AGENT_SYNC_LOG.md`

## What changed
### 1. Weak snippet suppression stays in place
Both artifact-aware inventory and chunk fallback still suppress:
- broken Hebrew spacing like `א ת השטף`
- repeated punctuation corruption like `פרמטרים,,,`
- corrupted parameter lists like `a b R I`
- duplicate weak `מקטע ג׳` entries

### 2. Tutor-style wording replaced backend-style wording
The inventory formatter now sounds like a natural Hebrew tutor reply instead of a pipeline status report.

#### Old wording removed
- `הקובץ זוהה והטקסט חולץ`
- `אני עובד עם הטקסט שחולץ`
- `מקטעים שזוהו חלקית`
- `מספר עמודים שזוהו`
- `מספר שאלות/מקטעים שזוהו`

#### New wording added
Examples of the new tone:
- `כן, אני רואה שהעלית קובץ אחד.`
- `נראה שזה קובץ בפיזיקה/אלקטרומגנטיות עם כמה שאלות/סעיפים.`
- `חלק מהנוסחאות לא חולצו מספיק טוב, אז אני לא רוצה להציג אותן כאילו הן ודאיות.`
- `הכי טוב לבחור סעיף/שאלה מסוימים ונעבוד עליהם בזהירות.`

### 3. Weak cases now guide the user conversationally
When extraction is weak, the response now:
- stays honest
- avoids visual/Gemini/internal-pipeline claims
- avoids fake-clean summaries
- gives one practical next step instead of a system-status explanation

### 4. Clean inventory summaries still work
For readable files, the inventory still shows useful questions/sections. The change is mainly in tone and snippet suppression, not in routing or retrieval behavior.

## Behavior now
### Clean file case
The reply now sounds like a tutor noticing the file and offering a quick high-level orientation, then showing the useful sections/questions.

### Weak extraction case
The reply now says, in natural Hebrew, that some formulas did not come through cleanly and that it is better to focus on one specific question/section carefully.

## Response style policy
- conversational Hebrew tutor voice
- concise and user-centered
- no backend/status-report wording
- honest about weak extraction
- no visual/Gemini claims
- one practical next step
- tests check for forbidden phrases, missing broken snippets, honest weak-extraction wording, and a practical next step — not one fixed canned paragraph

## Honesty/scope preserved
- No visual PDF understanding claim was added.
- No Gemini run was claimed.
- No formula reliability claim was added.
- No clean summary is invented when extraction is weak.
- No routing, retrieval, upload/extract/chunk, or UI behavior was changed.

## Tests updated
### `tests/server/tutor/fileInventoryService.test.ts`
- natural Hebrew tutor phrasing for clean chunk inventory
- conversational weak-extraction wording
- no backend/status-report language
- weak snippet suppression preserved
- clean chunk fallback still renders useful summaries
- artifact-aware inventory tone updated to the new tutor style
- assertions now follow a small response-style policy rather than pinning one exact full sentence

### `tests/server/workspaces/sessionMessageApiService.test.ts`
- exact Hebrew inventory phrase still bypasses model
- natural tutor phrasing at runtime
- no backend/status-report wording in runtime inventory responses
- weak extraction explained honestly
- no visual/Gemini claims
- broken snippets still suppressed in both artifact-aware and chunk fallback paths

### `tests/behavior/mvpFileLearningPipeline.test.ts`
- smoke-flow expectations updated to the new tutor phrasing
- exact Hebrew inventory phrase still uses the deterministic inventory path

## Validation
- `graphify query "file inventory artifact fallback chunk snippets low quality"` ✅
- `graphify query "maybeBuildArtifactAwareInventoryContent fallback buildFileInventory"` ✅
- `graphify query "buildFileInventory low quality math snippets"` ✅
- `graphify query "sessionMessageApiService file_content_inventory response"` ✅
- `npx tsc --noEmit` ✅
- `npx vitest run tests/server/tutor/fileInventoryService.test.ts` ✅
- `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts` ✅
- `npx vitest run tests/behavior/mvpFileLearningPipeline.test.ts` ✅
- `npx vitest run` ✅
- `npm run build` ✅
- `git diff --check` ✅
- `graphify update .` ✅

## Ready for review
- YES

## Safety confirmations
- I did not call Gemini.
- I did not change normal tutor Q&A.
- I did not change retrieval.
- I did not change upload/extract/chunk.
- I did not change UI.
- I did not run `git add`.
- I did not commit.
- I did not push.
- I did not run `git pull`.
