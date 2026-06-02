# PDF Reading Batch 6C.1 — Artifact Inventory Quality Tightening Report

## 1. Branch name and HEAD commit
- Branch: `repair/artifact-aware-file-inventory`
- HEAD: `c369005 feat: use document artifacts in file inventory`

## 2. Files changed
- `src/server/tutor/fileInventoryService.ts`
- `tests/server/tutor/fileInventoryService.test.ts`
- `tests/server/workspaces/sessionMessageApiService.test.ts`
- `agent-memory/PDF_READING_BATCH_6C1_ARTIFACT_INVENTORY_QUALITY_TIGHTENING_REPORT.md`
- `agent-memory/DUAL_AGENT_SYNC_LOG.md`

## 3. Implementation summary
- Tightened artifact usefulness filtering inside `fileInventoryService.ts` so weak extracted artifact snippets are no longer surfaced as if they were trustworthy clean section summaries.
- Added low-quality artifact detection for:
  - broken Hebrew spacing fragments
  - repeated punctuation like `,,,`
  - corrupted parameter-list patterns such as `a b R I`
  - short low-information fragments
  - existing garbled math-like extraction signals
- Added duplicate-label suppression so repeated weak entries such as repeated `מקטע ג׳` do not produce multiple noisy inventory lines.

## 4. Quality filtering
Artifact details are now suppressed when they look untrustworthy, including:
- broken Hebrew fragments such as `א ת השטף המגנטי`
- repeated punctuation artifacts such as `פרמטרים,,,`
- parameter-list garbage with too many single-letter Latin tokens
- weak math-garbled previews already caught by the existing math-quality heuristic
- low-information short fragments that do not read like a real summary

If the artifact layer has document facts but the extracted question/section snippets are too weak, the response now prefers a conservative message:
- `זוהו מקטעים/שאלות בקובץ, אבל איכות החילוץ לא מספיקה כדי להציג אותם כסיכום אמין.`
- followed by guidance to choose a page/question or send a short quote

## 5. De-duplication
- Artifact items are now de-duplicated by label.
- Duplicate labels are kept only if they are clearly distinct **and** both details are clean.
- Low-quality duplicate labels are suppressed, with the stronger candidate retained only when it is materially better.

## 6. Weak artifact wording
- Weak artifact cases no longer present broken snippets as usable section summaries.
- The response stays honest about partial extraction quality.
- The response does not claim visual PDF understanding.
- The response does not claim formulas are reliable.
- The response does not claim Gemini ran.

## 7. Fallback behavior
- Batch 6C chunk fallback behavior remains intact.
- If artifact details are too weak, the artifact-aware formatter now degrades to a conservative partial summary instead of fake-clean entries.
- No tutor Q&A, retrieval, upload, extraction, chunking, or UI behavior changed.

## 8. Gemini isolation
- No Gemini provider was imported or called.
- No runtime Gemini path was added.
- No Firebase Storage PDF bytes loading was added.

## 9. Tests added / updated
Updated `tests/server/tutor/fileInventoryService.test.ts` to cover:
- suppressing broken Hebrew artifact snippets
- de-duplicating duplicate weak labels like `מקטע ג׳`
- suppressing `,,,` / parameter-list corruption
- keeping clean artifacts visible normally

Updated `tests/server/workspaces/sessionMessageApiService.test.ts` to cover:
- the runtime inventory response suppressing weak duplicate artifact sections
- returning the general low-quality extraction warning instead of fake summaries
- preserving model bypass for the exact Hebrew inventory path

## 10. Validation results
- `npx tsc --noEmit` — passed
- `npx vitest run` — passed (`63` files passed, `18` skipped; `713` tests passed, `121` skipped)
- `npm run build` — passed
- `git diff --check` — passed
- `graphify update .` — passed

## 11. Risks / open decisions
- Artifact-aware inventory still targets one ready file at a time, consistent with the current shortcut behavior.
- The current tightening is heuristic by design; later document-understanding batches may still want richer section-quality metadata from the provider layer.
- Page/source citations are still not surfaced in the tutor-visible inventory response yet.

## 12. Confirmation that no git add / commit / push was run
- Confirmed:
  - No `git add`
  - No `git commit`
  - No `git push`

## 13. Confirmation that no git pull was run
- Confirmed:
  - No `git pull`
