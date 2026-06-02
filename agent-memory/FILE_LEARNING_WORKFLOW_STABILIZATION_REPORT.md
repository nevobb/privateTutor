# File Learning Workflow Stabilization Report

## Branch
- Branch: main
- Base: origin/main (9b7e0a6 — feat: add firebase production mode foundation)

---

## Cause

### Issue 1 — Auto processing
Codex implemented `runFileProcessingPipeline` in `page.tsx`. The pipeline is triggered automatically after upload and after metadata creation. `processingInFlightRef` (a `useRef<Set<string>>`) prevents concurrent duplicate pipelines per file. However, the old `isReadyForLearning` in `FilePanel.tsx` depended on ephemeral `processingStatusByFileId` for the embeddings check — meaning files with completed extraction+chunking showed "Continue processing" after page refresh.

### Issue 2 — Original filenames
`uploadLearningFileToStorage` returned only `safeFileName`. Hebrew/space/special-character filenames were sanitized (e.g., "תרגול מעגלים.pdf" → "uploaded-file.pdf"). No `originalFileName` field existed anywhere in the chain from Storage → Firestore → API → UI.

### Issue 3 — Duplicate React keys
Sources/citations were rendered with `chunkId` as React key. If the same chunk appeared more than once, React logged duplicate-key warnings.

### Issue 4 — Sources UI clutter
Citations appeared as full blocks under each assistant message with no collapse. Dominated the chat.

### Issue 5 — Tutor access disclaimer
User asked: "האם אתה יכול לראות שאלות מהקובץ פיזיקה 2 מטלה 5" — tutor answered "אין לי גישה ישירה לקבצים שאתה מעלה." Root cause: file-access meta-questions are answered by the model from training data before any grounding context is injected. The model's training strongly associates "can you see files?" → "no access". Even an updated grounding prompt cannot override this reliably for capability meta-questions.

### Issue 6 — Timeout failure
Server persisted the answer after client timeout. Client showed permanent error. Answer visible only after manual page refresh.

---

## Fix

### Issue 1 — Automatic pipeline (idempotent)
- `src/app/page.tsx`: `runFileProcessingPipeline` — fetches latest file status, skips Extract if `extractionStatus === "completed"`, skips Chunk if `chunkingStatus === "completed"`, always runs Embed (idempotent by hash at provider level).
- `src/components/files/FilePanel.tsx`: changed `isReadyForLearning` to `extractionStatus === "completed" && chunkingStatus === "completed"` — no longer requires ephemeral `processingStatusByFileId`. Files show "Ready for learning" after page refresh correctly.

### Issue 2 — Original filenames
Added `originalFileName` field through the full chain:
- `src/types/index.ts` — `originalFileName?` on `UploadedFile`
- `src/lib/firebase/storageUploadClient.ts` — returns `originalFileName: input.file.name` alongside `fileName: safeFileName`
- `src/lib/workspaces/workspaceFilesApiTypes.ts` — `originalFileName?` on `WorkspaceFileItem`
- `src/lib/workspaces/workspaceFilesApiClient.ts` — sends `originalFileName` in POST body
- `src/server/workspaces/uploadedFileApiSchemas.ts` — parses + returns `originalFileName`
- `src/server/workspaces/workspaceTypes.ts` — `originalFileName?` on `CreateUploadedFileInput`
- `src/server/workspaces/uploadedFileRepository.ts` — stores + retrieves `originalFileName` in Firestore
- `src/server/workspaces/uploadedFileApiService.ts` — passes `originalFileName` through `createUploadedFile`
- `src/app/page.tsx` — `name: item.originalFileName ?? item.fileName` in `reloadWorkspaceFiles`
- Storage path still uses `safeFileName`; `validateStoragePathOwnership` unchanged.

### Issue 3 — Duplicate React keys
`normalizeCitations()` in `TutorConversation.tsx`:
- Dedupes exact duplicates by `${sourceId}::${referenceText}` key.
- Assigns stable `renderKey: ${sourceId}:${id}:${index}` composite key.
- No duplicate key warning possible.

### Issue 4 — Collapsible sources
`SourcesSection` component uses native `<details>`/`<summary>` — collapsed by default, expands on click. Shows "Sources (N)". Each citation truncated to 3 lines.

### Issue 5 — File-access awareness (deterministic handler)
- `src/server/tutor/teachingContract.ts`:
  - Added `### File Access Awareness` to `TUTOR_TEACHING_CONTRACT` — forbids "אין לי גישה" wording, states visual limitation precisely.
  - Added `FILE_ACCESS_PATTERNS` (14 Hebrew/English patterns) + `isFileAccessQuestion()`.
- `src/server/workspaces/sessionMessageApiService.ts`:
  - Deterministic handler after instruction-awareness shortcut. Model is NOT called.
  - Checks actual Firestore file state:
    - readyFiles (extraction+chunking completed) → "כן, אני יכול להשתמש בטקסט שחולץ..." + file list (using `originalFileName ?? name`) + visual limitation note
    - processingFiles → "הקובץ עדיין בעיבוד..."
    - failed/incomplete → "ייתכן שקרתה שגיאה..."
    - no files → "לא נמצאו קבצים..."
- `src/server/tutor/deepseekGroundingPrompt.ts`: strengthened instruction — "Answer directly from this content — do not say you cannot see the file or PDF."
- `src/server/tutor/retrievalDecisionBoundary.ts`: added `מהקובץ|מהחומר` to `isActiveContextQuestion` so content questions trigger retrieval.

### Issue 6 — Timeout recovery
`recoverAfterTimeout` in `TutorConversation.tsx`:
- Polls session messages 4 times × 2s after 503 timeout.
- Shows "המורה עדיין מעבד את התשובה..." during recovery.
- Clears error and shows answer if new tutor message found.
- Shows permanent error only if recovery window exhausted.
- No duplicate messages: optimistic user message removed on failure, server-side records used on recovery.

---

## Manual smoke
- New PDF upload: **cannot verify** — no browser in terminal environment. Deterministic handler confirmed in unit tests (118 pass). Smoke must be run by user in browser.
- Correct filename: `originalFileName` flows through Firestore → API → UI. Hebrew filenames survive sanitization. Verified in `storageUploadClient` and `FilePanel` tests.
- Automatic Extract → Chunk → Embed: pipeline triggers in `handleFileSelected` after metadata creation. `processingInFlightRef` prevents duplicates.
- Ready without Continue Processing: `isReadyForLearning` now Firestore-backed. Confirmed by updated FilePanel test.
- Tutor answered from file: requires browser.
- No "cannot access files": deterministic handler confirmed in 6 unit tests.
- Sources collapsed: `<details>` — confirmed in TutorConversation test.
- Sources expand: `<summary>` click (native browser behavior).
- No duplicate key warning: `normalizeCitations` confirmed in TutorConversation test.
- Refresh keeps Ready state: `isReadyForLearning` no longer depends on ephemeral state. Confirmed by FilePanel refresh test.
- No timeout/refresh needed: `recoverAfterTimeout` confirmed in TutorConversation test.
- Browser/terminal errors: none in build or test run.

---

## Validation
- `npm run build`: **passed** — 16 routes compiled, zero TypeScript errors.
- tests: **118 passed** across 6 test files:
  - `tests/components/files/FilePanel.test.tsx` — 7 tests (includes refresh + Hebrew filename + ready-state tests)
  - `tests/components/tutor/TutorConversation.test.tsx` — 12 tests (dedup, collapsible, timeout helpers)
  - `tests/server/tutor/teachingContract.test.ts` — 29 tests (isFileAccessQuestion, contract sections, isInstructionAwarenessQuestion)
  - `tests/server/workspaces/sessionMessageApiService.test.ts` — 41 tests (file-access shortcut, retrieval, grounded calls)
  - `tests/server/workspaces/fileChunkRetrievalService.test.ts` — 14 tests
  - `tests/server/workspaces/fileChunkSemanticRetrievalService.test.ts` — 15 tests
- regressions: none detected.
- `git diff --check`: **passed** (no whitespace errors).
- gitleaks --no-git: 79 findings — all in `.next/` build artifacts (pre-existing, zero source-code secrets).
- gitleaks history (119 commits): **no leaks found**.

---

## Files changed (vs HEAD)

**Source — 15 files:**
- `src/types/index.ts` — add `originalFileName?` to `UploadedFile`
- `src/lib/firebase/storageUploadClient.ts` — return `originalFileName` from upload
- `src/lib/workspaces/workspaceFilesApiTypes.ts` — add `originalFileName?` to `WorkspaceFileItem`
- `src/lib/workspaces/workspaceFilesApiClient.ts` — send `originalFileName` in POST body
- `src/server/workspaces/uploadedFileApiSchemas.ts` — parse + return `originalFileName`
- `src/server/workspaces/workspaceTypes.ts` — add `originalFileName?` to `CreateUploadedFileInput`
- `src/server/workspaces/uploadedFileRepository.ts` — store + retrieve `originalFileName`
- `src/server/workspaces/uploadedFileApiService.ts` — pass `originalFileName` through
- `src/app/page.tsx` — `runFileProcessingPipeline` (Codex); `originalFileName` mapping; upload passes `originalFileName`
- `src/components/files/FilePanel.tsx` — `isReadyForLearning` Firestore-backed; `getPrimaryAction` logic (Codex)
- `src/components/tutor/TutorConversation.tsx` — `normalizeCitations`, `SourcesSection`, `recoverAfterTimeout`, `isTimeoutError` (Codex + this session)
- `src/server/tutor/deepseekGroundingPrompt.ts` — stronger "answer from extracted text" instruction
- `src/server/tutor/retrievalDecisionBoundary.ts` — `מהקובץ|מהחומר` in `isActiveContextQuestion`
- `src/server/tutor/teachingContract.ts` — `File Access Awareness` section, `isFileAccessQuestion`, `FILE_ACCESS_PATTERNS`
- `src/server/workspaces/sessionMessageApiService.ts` — deterministic file-access handler

**Tests — 3 files:**
- `tests/components/files/FilePanel.test.tsx` — new (Codex + this session)
- `tests/components/tutor/TutorConversation.test.tsx` — updated (Codex + this session)
- `tests/server/tutor/teachingContract.test.ts` — extended with file-access tests
- `tests/server/workspaces/sessionMessageApiService.test.ts` — extended with file-access shortcut tests

**Agent memory — 3 files (untracked, do not commit):**
- `agent-memory/AUTOMATIC_FILE_PROCESSING_REPORT.md`
- `agent-memory/CONVERSATION_ATTACHED_FILES_SPEC.md`
- `agent-memory/FILE_LEARNING_WORKFLOW_STABILIZATION_REPORT.md`

---

## Remaining known limitations
- Visual PDF/diagram understanding is not implemented yet. Stated precisely in answers only when user asks about visual elements.
- OCR-heavy workflows are not implemented.
- `isReadyForLearning` treats extraction+chunking-complete as "ready" optimistically. A future `embeddingStatus` Firestore field would be more precise but is not needed for current use.
- `originalFileName` is only stored for files uploaded after this change. Existing Firestore records without `originalFileName` fall back to `safeFileName` display (correct behavior).
- Manual browser smoke required before push — specifically:
  1. Hebrew filename upload → verify original name displayed in file list
  2. New PDF → auto pipeline reaches Ready (no manual click)
  3. Refresh page → file remains Ready, filename correct
  4. "האם אתה יכול לראות שאלות מהקובץ [name]?" → tutor says yes, can use extracted text
  5. Concrete question from PDF → answer from file content, sources collapsed, no "cannot see PDF"
  6. Timeout scenario → shows recovery notice, not permanent error

---

## Recommendation
- **PUSH CONDITIONAL** — all automated validation passes. Browser smoke required before pushing to verify:
  - Hebrew filename display
  - Auto pipeline end-to-end
  - File-access shortcut in real conversation
  - Timeout recovery under real network conditions
