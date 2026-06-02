# Document Understanding Stabilization Batch Report

## 1. Branch name
`repair/document-inventory-quality-warning`

## 2. Root problem
The text-only document pipeline was technically honest but still awkward for math/physics PDFs. `fileInventoryService` could suppress obviously garbled formula glyph soup, but the remaining response still mixed weak extracted headings, partial broken sentences, and inline low-quality placeholders in a way that felt clumsy for a tutor workflow.

## 3. Files changed
- `src/server/tutor/fileInventoryService.ts`
- `tests/server/tutor/fileInventoryService.test.ts`
- `tests/server/workspaces/sessionMessageApiService.test.ts`
- `tests/behavior/mvpFileLearningPipeline.test.ts`

## 4. Behavior before
- The inventory path stayed local and deterministic, but the response format still felt rough for noisy PDFs.
- Low-quality sections could read like broken question text followed by an awkward placeholder-style omission.
- The extraction-quality warning existed, but the overall inventory answer was not structured cleanly enough for a math/physics tutor experience.
- Exact uploaded-file smoke phrasing now reached the inventory path, but the resulting answer still looked partially machine-spilled rather than intentionally formatted.

## 5. Behavior after
- The inventory response now starts with a clearer structure: file detected, text extracted, text-only limitation, then detected sections.
- Garbled math/formula snippets are still suppressed, but they are no longer replaced with a noisy inline placeholder inside the section preview.
- Low-quality sections are rendered as partial detections with cleaner labels such as `מקטע ג׳` and a short partial-detection note instead of raw glyph soup.
- Clean Hebrew/English extracted previews still appear normally when they are actually readable.
- The inventory path still bypasses the model for uploaded-file inventory questions, including the exact smoke phrase.

## 6. How the response is now structured
For structured inventory responses, the formatter now follows this shape:
1. `הקובץ זוהה והטקסט חולץ.`
2. Explicit text-only disclaimer: the tutor works from extracted text, not visual PDF access.
3. A single extraction-quality warning when low-quality math/symbol extraction is detected.
4. A section list under either `מקטעים שזוהו:` or `מקטעים שזוהו חלקית:` depending on extraction quality.
5. A closing prompt asking the user to choose a question/section or cite a page/snippet for more reliable follow-up help.

## 7. Tests added/updated
- `tests/server/tutor/fileInventoryService.test.ts`
  - clean extracted text still renders normally
  - garbled math snippets are not shown
  - no inline placeholder is inserted mid-sentence
  - low-quality math extraction emits one clear warning
  - noisy Hebrew letter headings are rendered more cleanly
- `tests/server/workspaces/sessionMessageApiService.test.ts`
  - inventory response for garbled math chunks bypasses the model
  - no-access refusal does not appear
  - exact smoke phrase returns structured inventory output
  - visual PDF access is not claimed
- `tests/behavior/mvpFileLearningPipeline.test.ts`
  - exact smoke phrase returns the structured local inventory response end-to-end

## 8. Validation results
- `git branch --show-current` — passed (`repair/document-inventory-quality-warning`)
- `git status --short` — working tree reflects only this repair batch changes
- `npx vitest run tests/server/tutor/fileInventoryService.test.ts` — passed
- `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts` — passed
- `npx vitest run tests/behavior/mvpFileLearningPipeline.test.ts` — passed
- `npx tsc --noEmit` — passed
- `npx vitest run` — passed (`59` files passed, `17` skipped; `594` tests passed, `116` skipped)
- `npm run build` — passed
- `git diff --check` — passed
- `graphify update .` — passed

## 9. What was intentionally not implemented
- OCR
- Gemini Vision or any visual PDF understanding
- page-image rendering
- replacement of the existing PDF extraction provider
- math reconstruction into LaTeX
- model-based cleanup of extracted PDF text
- new math tool dependencies or CAS integration
- full document-understanding/data-model redesign

## 10. Recommended future PDF-reading upgrade
The right next upgrade is a narrow page-aware document understanding layer: preserve page-level extracted text, detect question/section boundaries as first-class records, and attach extraction-quality metadata per section. That would improve math/physics tutoring much more safely than trying to make raw chunk previews carry the full load.

## 11. Confirmation that no git add / commit / push was run
Confirmed: no `git add`, `git commit`, or `git push` was run.

## 12. Confirmation that no git pull was run
Confirmed: no `git pull` was run.
