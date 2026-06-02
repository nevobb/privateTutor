# Document Inventory Quality Repair Report

## 1. Branch name

- `repair/document-inventory-quality-warning`

## 2. Root cause

- The document inventory path is deterministic and text-only:
  - PDF → `pdf-parse` raw text → whitespace normalization → chunks → inventory preview
- For math-heavy PDFs, broken extraction artifacts could appear in chunk previews, such as:
  - `0 0 1 2  a B I `
- `src/server/tutor/fileInventoryService.ts` previously surfaced those raw previews directly in the user-visible inventory response.

## 3. Files changed

- `src/server/tutor/fileInventoryService.ts`
- `tests/server/tutor/fileInventoryService.test.ts`
- `tests/server/workspaces/sessionMessageApiService.test.ts`

## 4. Detection heuristic added

Added `isLowQualityMathExtractionPreview(preview: string)` to `src/server/tutor/fileInventoryService.ts`.

The heuristic marks a preview as low quality when it shows signs of garbled formula extraction, specifically:

- any private-use glyphs (`[\uF000-\uF8FF]`)
- or a dense mix of:
  - math operators/symbols
  - many single-character tokens
  - enough numeric tokens

Concrete rule:

- immediately low-quality if private-use glyphs are present
- otherwise low-quality when:
  - at least `6` tokens
  - contains math-operator-like characters
  - single-character token ratio `>= 0.45`
  - digit-token ratio `>= 0.2`

## 5. Why the heuristic is narrow and safe

- It only affects the **preview display layer** inside file inventory output.
- It does **not** change:
  - extraction
  - chunking
  - retrieval
  - model/provider behavior
  - routing
- It preserves readable Hebrew/English previews unchanged.
- It only suppresses previews that are strongly indicative of broken math extraction rather than normal prose.

## 6. User-facing behavior before/after

### Before

- Inventory responses could display raw broken formula glyph soup directly.
- The tutor gave a general text-only disclaimer, but no specific warning that formula extraction quality was unreliable.

### After

- Clean previews still render as before.
- Garbled math-heavy previews are replaced with a safe placeholder:
  - `תצוגת הנוסחה/הסימון הושמטה כי חילוץ הטקסט בחלק הזה באיכות נמוכה.`
- When any inventory section has low-quality math extraction, the response now includes an explicit warning:
  - the file was detected and extracted
  - some formulas/symbols were extracted poorly
  - the system is intentionally not showing them as-is
  - the user can choose a question/section or ask a targeted question

## 7. Tests added/updated

### `tests/server/tutor/fileInventoryService.test.ts`

Added:

- low-quality detection for:
  - `0 0 1 2  a B I `
- inventory response does not expose the raw broken snippet
- inventory response includes extraction-quality warning
- negative case proving clean Hebrew/English previews still show normally

### `tests/server/workspaces/sessionMessageApiService.test.ts`

Added service-level proof that garbled math-heavy inventory responses:

- bypass the model
- do not say “no access”
- do not dump the raw broken snippet
- include the extraction-quality warning

## 8. Validation commands and results

### Focused validation

- `npx vitest run tests/server/tutor/fileInventoryService.test.ts`
  - Passed
- `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts`
  - Passed

### Required project validation

- `npx tsc --noEmit`
  - Passed
- `npx vitest run`
  - Passed
  - Summary: `59` passed, `17` skipped; `591` tests passed, `116` skipped
- `npm run build`
  - Passed
- `git diff --check`
  - Passed
- `graphify update .`
  - Passed

## 9. What was intentionally not fixed

- No OCR
- No visual PDF analysis
- No page-image rendering
- No Gemini Vision
- No SymPy / mathjs / CAS
- No document-understanding redesign
- No retrieval redesign
- No chunking redesign
- No formula reconstruction into LaTeX
- No page-aware document model

## 10. Remaining risks

- The heuristic is intentionally conservative and may miss some other classes of bad formula extraction
- Extraction quality is still fundamentally limited by `pdf-parse`
- Inventory remains best-effort regex scanning over chunks
- Multi-file inventory still uses only the first ready file
- The system still cannot reconstruct correct mathematical notation from badly extracted PDFs

## 11. Confirmation that no git add / commit / push was run

- No `git add`
- No `git commit`
- No `git push`

## 12. Confirmation that no git pull was run

- No `git pull`
