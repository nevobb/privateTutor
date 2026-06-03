# PDF Reading Batch 8E — Tutor Deep PDF State Behavior Report

## 1. Branch name and HEAD commit
- Branch: `repair/deep-pdf-tutor-state-behavior`
- HEAD: `1e14d1a fix: respect cost mode for Deep PDF auto-run`

## 2. Files changed
Modified:
- `src/server/tutor/fileInventoryService.ts`
- `src/server/workspaces/sessionMessageApiService.ts`
- `tests/server/tutor/fileInventoryService.test.ts`
- `tests/server/workspaces/sessionMessageApiService.test.ts`

Memory/docs:
- `agent-memory/PDF_READING_BATCH_8E_TUTOR_DEEP_PDF_STATE_BEHAVIOR_REPORT.md`
- `agent-memory/DUAL_AGENT_SYNC_LOG.md` (sync entry appended)

## 3. Behavior implemented for each Deep PDF state

### recommended (tightened after review)

**recommended + weak/partial/poor extraction (common case):**
- **Early exit** — no list rendered
- Message: "נראה שזה קובץ שמצריך קריאה עמוקה יותר לפני שאפשר לסכם אותו בביטחון — הטקסט שחולץ לא מספיק ברור לסיכום הנוסחאות והסעיפים.\nאם אתה רוצה להתקדם מיד, תבחר שאלה מסוימת או תדביק קטע — ונעבוד עליו ישירות."
- No partial/broken snippets shown
- No "אלה הסעיפים..." wording
- File name/subject intro still shown

**recommended + genuinely clean artifacts (rare case: extractionQuality=good, isPartial=false, no partial items):**
- Short list shown with focus suggestion: "אם יש שם נוסחה או תרשים שחשובים לך במיוחד, עדיף לבחור שאלה או סעיף מסוים ונתמקד רק בהם."
- No Gemini/advanced analysis claim

**Quality gate: `canShowListForRecommended`:**
```ts
// Only show list when artifacts are genuinely clean
if (items.length === 0) return false;
if (extractionQuality !== "good") return false;
if (isPartial) return false;
if (items.some(item => item.isPartial)) return false;
return true;
```

**Grounding note:** "Advanced document understanding may be needed for formulas or diagrams in this file. Do not claim that such analysis already ran."

### pending
- **Early exit** — no snippet list shown at all
- Message: "אני עדיין קורא את הקובץ לעומק. אם אתה רוצה להתקדם מיד, תדביק כאן את הסעיף או תכתוב איזה שאלה, ונעבוד עליה בינתיים."
- File name/subject intro still shown (file was recognized)
- Grounding note added: "Advanced document understanding is currently in progress for this file. Keep your response tentative — do not claim deep analysis has completed."

### completed
- List shown with confident intro: "עברתי על הקובץ ואלה הנושאים שמצאתי:"
- Extraction weakness warning **suppressed** — Deep PDF completed so the extraction quality signal is no longer the limiting factor
- Artifact content shown normally
- No false visual/formula certainty claims
- Grounding note added: "Advanced document understanding completed for this file. You may express moderate confidence about document structure and section layout, but still ground factual claims in the retrieved chunk text."

### failed
- **Early exit** — no snippet list shown
- Message: "הקריאה העמוקה של הקובץ לא הושלמה, אז אני לא רוצה להמציא סיכום לא אמין. אם תשלח את הסעיף או תבחר שאלה, נוכל לעבוד עליה ישירות."
- No technical error codes or backend details
- File name/subject intro still shown
- Grounding note added: "Advanced document understanding failed for this file. Do not claim the file was deeply analysed. Keep responses based only on retrieved chunk text and be honest about limitations."

## 4. Inventory behavior changes

### `formatArtifactAwareFileInventoryResponse`
- Added `pending` and `failed` as early exits (no list rendered)
- Updated `completed` list intro: `"עברתי על הקובץ ואלה הנושאים שמצאתי:"`
- Updated partial list intro: `"הנה הסעיפים שמצאתי בקובץ — הצגתי רק את הברורים שביניהם:"`
- Updated clean list intro: `"אלה הנושאים שמצאתי בקובץ:"`
- Extraction warning now suppressed when `deepPdfStatus === "completed"`
- Fact line: "אני מצליח לזהות בו בערך X שאלות/סעיפים." → "יש בו בערך X שאלות/סעיפים." (less parser-like)
- Suppressed-artifacts message: old → new (more natural)

### Forbidden phrases removed/replaced
| Old phrase | New phrase | Location |
|---|---|---|
| "חלק מהנוסחאות לא חולצו מספיק טוב" | "חלק מהנוסחאות לא יצאו ברורות" | `buildWeakExtractionWarning()` |
| "אלה הדברים שאני מצליח להוציא ממנו בזהירות:" | "הנה הסעיפים שמצאתי בקובץ — הצגתי רק את הברורים שביניהם:" | `buildListIntroLine()` |
| "אלה הדברים שאני מצליח לראות ממנו כרגע:" | "אלה הנושאים שמצאתי בקובץ:" | `buildListIntroLine()` |
| "אלה הסעיפים שאני מצליח לקרוא ממנו בזהירות:" | "הנה הסעיפים שמצאתי — חלק מהניסוחים עשוי להיות פחות מדויק:" | `formatFileInventoryResponse()` |
| "אלה הסעיפים שאני מצליח לראות ממנו כרגע:" | "אלה הנושאים שמצאתי בקובץ:" | `formatFileInventoryResponse()` |
| "אני כן רואה שיש שם שאלות...החילוץ לא מספיק נקי כדי..." | "יש שם שאלות...הטקסט שלהם לא מספיק ברור כדי..." | `formatArtifactAwareFileInventoryResponse()` |
| "הכי טוב לבחור סעיף/שאלה מסוימים ונעבוד עליהם בזהירות." | "הכי טוב לבחור סעיף/שאלה מסוימים ונעבוד עליהם." | `buildPracticalNextStep()` |

## 5. Grounding/prompt behavior changes

### `sessionMessageApiService.ts` — `maybeBuildArtifactAwareGroundingInstruction`
Replaced single `recommended`-only note with `buildDeepPdfGroundingNote(file.deepPdfStatus)` helper that handles all four states:

| State | Grounding instruction added to model |
|---|---|
| `recommended` | "Advanced document understanding may be needed for formulas or diagrams. Do not claim that such analysis already ran." |
| `pending` | "Advanced document understanding is currently in progress. Keep your response tentative — do not claim deep analysis has completed." |
| `completed` | "Advanced document understanding completed. You may express moderate confidence about document structure, but still ground factual claims in retrieved chunk text." |
| `failed` | "Advanced document understanding failed. Do not claim the file was deeply analysed. Keep responses based only on retrieved chunk text." |
| all others | No note added |

The helper is called at the end of each file's artifact loop, **after** other artifact notes, so it can add the state note even when no artifact matches were found (important for `pending` and `failed` where we want the model to be cautious regardless).

## 6. Tests added/updated

### `tests/server/tutor/fileInventoryService.test.ts` — 20 new tests (was 33, now 53)

New test group: "formatArtifactAwareFileInventoryResponse — Deep PDF state behavior"

**recommended + weak/partial (6 tests):**
- `partial` quality: hides list, says deeper reading needed
- `poor` quality: hides list, gives next action
- `partial` with broken snippet: no snippet shown in output
- No parser/status wording
- No Gemini claim
- `recommended + clean/good`: shows list with focus suggestion (1 test)

**pending (4 tests):**
- Says deeper reading is in progress
- Offers paste/choose as next action
- Does not show snippet list
- No parser/status wording

**completed (4 tests):**
- Shows list with confident intro ("עברתי על הקובץ")
- No extraction weakness warning shown
- Still shows artifact content
- Does not claim false formula/visual certainty

**failed (3 tests):**
- Says deeper reading did not complete
- Offers honest fallback next step
- No technical error dump, no fake summary

**regression (2 tests):**
- Clean text-only (not_started) shows normal list
- Undefined status (no deepPdfStatus) doesn't crash

### `tests/server/tutor/fileInventoryService.test.ts` — 3 existing tests updated
- Weak extraction warning text updated from old phrase to new phrase
- List intro text updated for partial state

### `tests/server/workspaces/sessionMessageApiService.test.ts` — 3 existing tests updated
- Weak extraction warning text updated to match new phrasing

## 7. Validation results
- `npx tsc --noEmit` — ✅ passed
- `npx vitest run` — ✅ 67 files passed, 18 skipped; 832 tests passed, 121 skipped
- `npm run build` — ✅ passed
- `git diff --check` — ✅ passed
- `graphify update .` — ✅ updated

## 8. What was intentionally not changed
- Deep PDF execution logic — not touched
- Gemini provider — not touched
- PDF bytes loader — not touched
- Cache policy — not touched
- Cost mode policy — not touched
- Upload/extract/chunk lifecycle — not touched
- Retrieval mechanics — not touched
- UI — not touched
- `deepseekGroundingPrompt.ts` — the visual limitation line is still there. It says "state only when directly relevant" which is correct; no change needed here.
- `teachingContract.ts` — not touched; the general teaching contract handles this
- Inventory routing (`sessionMessageApiService.ts` routing) — not touched; inventory still bypasses model for file_content_inventory

## 9. Risks / open decisions

### `pending` state shows early exit even if artifacts exist
When `deepPdfStatus === "pending"`, the function returns immediately without showing any artifact list. This is intentional — showing a partial text-only list while Deep PDF is running could be confusing. But if Deep PDF takes a long time, the user might ask again and get the same "in progress" response repeatedly. A future improvement: add a timeout note if pending for too long.

### `failed` state always shows early exit
Same design: no list when failed. If text-only artifacts are actually good quality (extractionQuality "good"), it might be more helpful to show them instead of the failed message. A future improvement: check `extractionQuality` and `items.length` before deciding whether to show the failed message or fall through to the list.

### Grounding note for `pending`/`failed` requires artifact match context
`buildDeepPdfGroundingNote` is called inside `maybeBuildArtifactAwareGroundingInstruction`. This function only runs when the user message references pages or sections (Hebrew page/section signals). So for general questions that don't reference specific sections, the pending/failed state grounding note won't be added. This is acceptable — the model's general behavior doesn't need the note for broad questions; it's most important when grounding specific artifact references.

### `completed` state grounding note appears even with weak artifacts
When `deepPdfStatus === "completed"` and the artifact text is poor quality, the grounding note still says "express moderate confidence." Future improvement: gate confidence level on `extractionQuality` even when completed.

## 10. Ready for final smoke?
**YES**

The tutor now:
- Hides weak/partial snippet lists when `deepPdfStatus === "recommended"` (tightened after review)
- Allows a short list only when `recommended` AND `extractionQuality === "good"` AND no partial items
- Early-exits for `pending` and `failed` (no list in either case)
- Shows confident content when `completed`
- Uses natural Hebrew tutor voice, no parser/status wording
- Sends appropriate model grounding instructions for each state
- Never claims Gemini/Deep PDF completed unless it actually did

## 11. Confirmation that no Gemini execution logic was changed
Confirmed. No changes to `deepPdfOrchestrationService.ts`, `GeminiPdfUnderstandingProvider`, `firebaseStoragePdfBytesLoader.ts`, `deepPdfCachePolicy.ts`, or any execution path.

## 12. Confirmation that no git add / commit / push was run
Confirmed:
- No `git add`
- No `git commit`
- No `git push`

## 13. Confirmation that no git pull was run
Confirmed:
- No `git pull`
