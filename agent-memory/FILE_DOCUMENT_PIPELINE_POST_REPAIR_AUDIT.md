# File / Document Pipeline Post-repair Audit

## 1. Branch name
- `repair/document-inventory-quality-warning`

## 2. Working tree status
- `git status --short` was clean before this audit report was written.
- After writing this report, the expected working tree change is this report file only.
- `git status -sb` showed the current branch tracking `origin/repair/document-inventory-quality-warning` with no ahead/behind divergence markers.

## 3. Recent commits checked
`git log --oneline -12`
- `27eabde` `fix: stabilize math-heavy document inventory output`
- `c808d1a` `fix: suppress low quality math inventory previews`
- `1493535` `docs: add document math visual pipeline diagnostic`
- `cf8a03d` `fix: classify Hebrew file inventory requests`
- `cd8b240` `docs: add file learning pipeline trace`
- `cb74131` `docs: add post-repair recovery audit`
- `881b055` `fix: persist file processing continuation`
- `a608724` `fix: replace stale sources context placeholder`
- `1549f16` `fix: block legacy placeholder retrieval grounding`
- `83122e7` `fix: wire file inventory into session message flow`
- `814d035` `test: restore TypeScript baseline`
- `adc3217` `chore: capture pre-repair recovery snapshot`

## 4. Graphify commands used
- `graphify query "requestClassifier file_content_inventory Hebrew uploaded files"`
- `graphify query "sessionMessageApiService file inventory model bypass"`
- `graphify query "fileInventoryService extraction quality math garbled preview"`
- `graphify query "mvpFileLearningPipeline exact smoke phrase"`
- `graphify query "document understanding stabilization inventory output"`

## 5. Reports inspected
- `agent-memory/FILE_LEARNING_PIPELINE_TRACE_REPORT.md`
- `agent-memory/TUTOR_FILE_INVENTORY_CLASSIFIER_REPAIR_REPORT.md`
- `agent-memory/DOCUMENT_MATH_VISUAL_PIPELINE_DIAGNOSTIC.md`
- `agent-memory/DOCUMENT_INVENTORY_QUALITY_REPAIR_REPORT.md`
- `agent-memory/DOCUMENT_UNDERSTANDING_STABILIZATION_BATCH_REPORT.md`
- `agent-memory/POST_REPAIR_RECOVERY_AUDIT_REPORT.md`

All requested reports are present.

## 6. Validation command results
### Repo state
- `git branch --show-current` → `repair/document-inventory-quality-warning`
- `git status --short` → clean before report write
- `git log --oneline -12` → recent repair commits present

### Required validation
- `npx vitest run tests/server/tutor/requestClassifier.test.ts` → passed (`46` tests)
- `npx vitest run tests/server/tutor/fileInventoryService.test.ts` → passed (`22` tests)
- `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts` → passed (`51` tests)
- `npx vitest run tests/behavior/mvpFileLearningPipeline.test.ts` → passed (`16` tests)
- `npx tsc --noEmit` → passed
- `npx vitest run` → passed (`59` files passed, `17` skipped; `594` tests passed, `116` skipped)
- `npm run build` → passed
- `git diff --check` → passed

## 7. Classifier audit
### Exact phrase
The exact phrase:
- `איזה קבצים העליתי לסביבת העבודה הזאת ומה יש בהם?`
is covered by automated tests and classifies as `file_content_inventory`.

### Evidence
- `src/server/tutor/requestClassifier.ts` contains uploaded-file inventory patterns, including:
  - `/(?:איזה|אילו)\s+קבצים\s+(?:העליתי|יש לי)(?:\s+בסביבת העבודה(?:\s+הזאת)?)?/i`
  - `/מה\s+יש\s+בקבצים\s+שהעליתי/i`
  - `/תראה לי את הקבצים שהעליתי/i`
  - `/תגיד לי\s+(?:איזה|אילו)\s+קבצים\s+העליתי(?:\s+ומה\s+(?:יש\s+בהם|התוכן\s+שלהם))?/i`
- `tests/server/tutor/requestClassifier.test.ts` covers:
  - exact smoke phrase
  - nearby Hebrew phrasings like `איזה קבצים העליתי?`, `אילו קבצים העליתי?`, `איזה קבצים יש לי בסביבת העבודה?`, `מה יש בקבצים שהעליתי?`, `תראה לי את הקבצים שהעליתי`, `תגיד לי איזה קבצים העליתי ומה התוכן שלהם`

### Negative guard
A negative guard exists:
- `איך מסבירים תוכן של קובץ טוב יותר?` remains `general_tutor_question`

### Audit result
- Exact phrase coverage: **yes**
- Nearby Hebrew phrasings covered: **yes**
- Guard against over-widening: **yes**

## 8. Runtime path audit
### UI route to service
- The UI chat route goes through `/api/sessions/[sessionId]/messages`.
- `src/app/api/sessions/[sessionId]/messages/route.ts` calls `sessionMessageApiService.sendMessageForUser(...)`.

### Inventory shortcut behavior
- `src/server/workspaces/sessionMessageApiService.ts` has a dedicated `file_content_inventory` branch.
- In that branch, the service:
  - calls `listUploadedFiles(...)`
  - selects a ready file when available
  - calls `listFileChunks(...)`
  - calls `buildFileInventory(...)`
  - calls `formatFileInventoryResponse(...)`
  - returns before the provider path
- The same file shows the general provider path only later via `getMockTutorResponse(...)`.

### Test evidence
- `tests/server/workspaces/sessionMessageApiService.test.ts` proves that inventory phrasing bypasses `getMockTutorResponse`.
- `tests/behavior/mvpFileLearningPipeline.test.ts` proves the exact smoke phrase returns the structured inventory path and does not call the model.

### Audit result
- UI chat reaches `sessionMessageApiService`: **yes**
- `file_content_inventory` bypasses model/provider: **yes**
- `listUploadedFiles` and `listFileChunks` are called when a ready file exists: **yes**

## 9. Inventory output audit
### Verified behavior
The current inventory response:
- does **not** use a “no access” refusal for inventory questions
- does **not** expose raw garbled formula snippets like `0 0 1 2  a B I `
- **does** include a clear low-quality extraction warning for noisy math/symbol sections
- does **not** claim visual PDF access
- **does** produce structured partial sections (`מקטעים שזוהו חלקית`) when extraction quality is poor

### Evidence
- `src/server/tutor/fileInventoryService.ts`:
  - starts responses with `הקובץ זוהה והטקסט חולץ.`
  - states `אני עובד עם הטקסט שחולץ מהקובץ, לא עם תצוגה חזותית של ה-PDF.`
  - emits one extraction-quality warning when low-quality math previews are detected
  - formats section output under `מקטעים שזוהו:` or `מקטעים שזוהו חלקית:`
- `tests/server/tutor/fileInventoryService.test.ts` verifies:
  - clean text still renders normally
  - garbled math snippets are not shown
  - no inline placeholder is inserted mid-sentence
  - one clear warning is emitted
- `tests/server/workspaces/sessionMessageApiService.test.ts` verifies:
  - no `אין לי גישה ישירה`
  - no visual-access claim
  - structured partial-section output for garbled math-heavy chunks

### Audit result
- No-access refusal avoided: **yes**
- Raw garbled snippet suppressed: **yes**
- Clear quality warning present: **yes**
- Visual PDF access not claimed: **yes**
- Structured partial sections present: **yes**

## 10. Test coverage audit
### Strong coverage
- Classifier intent coverage for exact and nearby Hebrew file-inventory phrasing
- Service-level model bypass and inventory-path behavior
- Inventory formatter behavior for clean text and garbled math-heavy chunks
- Behavior-level smoke proof for the exact uploaded-file inventory phrase
- Full TypeScript, full test suite, and build validation all pass

### Gaps that remain
- No dedicated route-level test for the exact smoke phrase through `/api/sessions/[sessionId]/messages`; current confidence comes from route wiring tests plus service/behavior tests
- No manual browser smoke proof is included in this audit
- No deeper PDF-reading fidelity test beyond current text extraction/inventory formatting boundaries

## 11. Remaining risks
### Must fix before continuing
- None found in the current audited scope

### Acceptable MVP limitation
- Inventory still uses only the first ready file instead of aggregating multiple ready files
- Inventory still depends on extracted headings and chunk text, so prose-only or layout-heavy documents will remain best-effort
- Math extraction quality is still fundamentally limited by `pdf-parse`

### Future PDF-reading upgrade
- Page-aware text preservation and section/question records from `docs/DOCUMENT_UNDERSTANDING_LAYER.md`
- Better extraction-quality metadata per section/page
- A more capable PDF-reading provider evaluation for math/physics-heavy documents

### Documentation/test gap
- The exact smoke phrase is covered at service/behavior level, but not with a dedicated route-level integration test
- Manual browser smoke is still recommended before broader product claims

## 12. Ready to move to PDF Reading Provider Evaluation
**Yes.**

Reason:
- The current text-only pipeline is now stable within its intended MVP boundaries.
- The classifier, runtime inventory path, model bypass, low-quality warning, garbled-snippet suppression, and structured inventory output are all verified.
- Remaining issues are now primarily capability limitations of the underlying PDF reading approach, which is exactly the right point to begin provider evaluation rather than more patch repairs.

## 13. Confirmation that no source code was edited
Confirmed.

This audit did not edit any source code or tests. The only file created by this audit is:
- `agent-memory/FILE_DOCUMENT_PIPELINE_POST_REPAIR_AUDIT.md`

## 14. Confirmation that no git add / commit / push was run
Confirmed:
- No `git add`
- No `git commit`
- No `git push`

## 15. Confirmation that no git pull was run
Confirmed:
- No `git pull`
