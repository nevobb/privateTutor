# Document Understanding Layer — Design

**Status: Design only. No implementation yet.**
**Scope: Text-based understanding in Phase A–D. Vision planned in Phase E, not implemented.**

---

## 1. Problem Statement

### Current pipeline

```
PDF/DOCX
  → pdf-parse / mammoth extraction   (produces raw text blob)
  → fixed-size text chunking         (800–1200 char windows)
  → OpenAI/Gemini embeddings         (per-chunk vectors)
  → Firestore chunk subcollection    (chunkId, text, vector)
```

### Why this is not enough

**"איזה שאלות יש בקובץ?"**
Chunks are produced by character-count window, not by document structure.
A question like "שאלה 3" may span two chunks. The next question starts mid-chunk.
The inventory handler (`fileInventoryService.ts`) tries to match regex patterns against chunk text.
Results are fragile: question boundaries split by chunker are missed; question labels buried mid-chunk are found by accident; confidence is zero.

**"תן לי רשימת תרגילים"**
Same problem. No concept of "exercise" exists in the data model.
The tutor has no structured list to read from — only raw chunk text.

**"תסביר לי שאלה 3"**
Semantic retrieval is called with query "שאלה 3".
The embeddings may rank a chunk from "שאלה 13" or the problem setup of "שאלה 4" higher than the actual text of "שאלה 3".
There is no deterministic resolution of "שאלה 3" to a specific text span.

**"מה מופיע בגרף?"**
No page-level data is stored. The tutor has no way to locate a graph (page N) or its surrounding text. The only option is to tell the user "visual PDF understanding not active" — even when the graph has an adjacent text caption that would answer the question.

**"מה הנושאים במטלה?"**
No document outline exists. Summarization must read all chunks, which is expensive. The model receives an unordered pile of text windows, not a structured view of the assignment's topic hierarchy.

### Root cause

The extraction pipeline treats the document as a flat text stream.
Page boundaries, question numbers, section headings, subsection nesting, and figure captions are all lost by the time chunks reach the tutor.

---

## 2. Target Capabilities

### A. Text-based document outline

Given any extracted text, build a structured outline:
- Document title or assignment label
- Sections (שאלה / Question / Exercise / Problem / numbered headings)
- Subsections (סעיף א/ב, part a/b, nested numbering)
- Question topics/summaries (one line per detected question)
- Source anchors: which chunk(s) each question maps to

The outline is stored separately from chunks so it can be read cheaply without vector search.

### B. Question-aware tutoring

User says "שאלה 3".
System resolves: `detectedQuestions` where `questionNumber === 3` OR `label.contains("שאלה 3")`.
Retrieves: the specific chunks referenced by that question's `sourceChunkIds`.
Tutor answers from those chunks, not from a broad semantic search.

Fallback: if `understandingStatus !== completed` for the file, fall back to semantic retrieval with query "שאלה 3".

### C. Text inventory

User says "איזה שאלות יש בקובץ?".
System reads `detectedQuestions` collection directly.
Returns structured list: `questionNumber`, `label`, `topic/summary`, `pageStart`.
No regex scanning of chunk text at answer time.
Response is deterministic, stable, and accurate.

### D. Visual on-demand support (future Phase E)

User asks about a graph, diagram, circuit, or table.
System identifies the relevant page number (from outline or detected question `pageStart`).
Retrieves the stored page image reference.
Sends that page image + question to Gemini Vision API.
Returns Vision answer with explicit note: "תשובה על סמך ניתוח חזותי של עמוד N."

Not run by default. Only triggered when:
1. Intent is `visual_reference_request`.
2. `visualIndexStatus === completed` (page images stored).
3. Relevant page can be identified from outline or question index.

---

## 3. Proposed Data Model

### UploadedFile document (updated fields)

```ts
interface UploadedFileRecord {
  id: string;
  userId: string;
  name: string;                    // safeFileName (storage path)
  originalFileName?: string;       // display name, preserved as-is
  sourceType: "pdf" | "docx" | "note" | "other";
  storagePath?: string;

  // Existing processing lifecycle
  extractionStatus: "not_started" | "pending" | "completed" | "failed";
  chunkingStatus:   "not_started" | "pending" | "completed" | "failed";
  embeddingStatus:  "not_started" | "completed" | "failed";

  // New lifecycle fields
  understandingStatus: "not_started" | "pending" | "completed" | "failed";
  understandingErrorCode?: string;
  understandingUpdatedAt?: Date;

  visualIndexStatus: "not_started" | "skipped" | "pending" | "completed" | "failed";
  visualIndexUpdatedAt?: Date;

  // Metadata from understanding
  pageCount?: number;
  detectedQuestionCount?: number;
  outlineTitle?: string;

  // Existing fields preserved...
  createdAt: Date;
  updatedAt: Date;
}
```

### Page subcollection

```
users/{userId}/uploadedFiles/{fileId}/pages/{pageId}
```

```ts
interface PageRecord {
  pageId: string;          // "page_0001" (1-indexed, zero-padded)
  pageNumber: number;      // 1-indexed
  extractedText: string;   // raw text from pdf-parse for this page
  cleanedText?: string;    // artifact-removed version
  textQuality: "good" | "partial" | "poor" | "empty";
  charCount: number;
  sourceChunkIds: string[]; // which chunks overlap this page
  optionalPageImageRef?: string;  // Storage path if image stored (Phase E only)
  createdAt: Date;
  updatedAt: Date;
}
```

### Document outline subcollection

```
users/{userId}/uploadedFiles/{fileId}/documentOutline/{outlineId}
```

Single document per file (one outline, replaced on recompute):

```ts
interface DocumentOutlineRecord {
  outlineId: string;        // always "v1" — single document
  fileId: string;
  title?: string;           // inferred document title, if detectable
  sections: DocumentSection[];
  confidence: "high" | "medium" | "low";
  createdAt: Date;
  updatedAt: Date;
}

interface DocumentSection {
  sectionId: string;
  label: string;            // e.g. "שאלה 1", "Part A", "Exercise 3"
  title?: string;           // topic title if extractable, else null
  pageStart?: number;
  pageEnd?: number;
  charStart: number;        // char offset in full extracted text
  charEnd: number;
  sourceChunkIds: string[];
  subsections: DocumentSection[]; // nested (e.g. "סעיף א", "b.")
  confidence: number;       // 0.0–1.0
}
```

### Detected questions subcollection

```
users/{userId}/uploadedFiles/{fileId}/detectedQuestions/{questionId}
```

One document per detected question:

```ts
interface DetectedQuestionRecord {
  questionId: string;       // e.g. "q_001"
  fileId: string;
  label: string;            // original text label: "שאלה 3", "Question 3", "3."
  questionNumber?: number;  // parsed integer if available
  topic?: string;           // one-line inferred topic: "חישוב פוטנציאל חשמלי"
  summary?: string;         // 1–2 sentence summary of the question content
  pageStart?: number;
  pageEnd?: number;
  charStart: number;
  charEnd: number;
  sourceChunkIds: string[];
  subsections: QuestionSubsection[];
  confidence: number;
  extractionNotes?: string; // e.g. "boundary inferred — math block follows text"
  createdAt: Date;
  updatedAt: Date;
}

interface QuestionSubsection {
  label: string;            // "(א)", "a.", "Part i"
  charStart: number;
  charEnd: number;
  sourceChunkIds: string[];
}
```

### Visual page images (Phase E only)

```
Storage: users/{userId}/workspaces/{workspaceId}/files/{fileId}/pages/page_{N:04d}.jpg
```

Not generated by default. `visualIndexStatus === "skipped"` until Phase E is triggered.
Only generated on explicit user action or when `visual_reference_request` is handled.

---

## 4. Processing Lifecycle

### Full future lifecycle

```
Upload
  → Extract text (extractionStatus: completed)
  → [Phase B] Store page-level text (pages subcollection)
  → [Phase B] Clean text (artifact removal)
  → Chunk extracted text (chunkingStatus: completed)
  → Embed chunks (embeddingStatus: completed)
  → [Phase C] Build document understanding:
      - detect questions → detectedQuestions subcollection
      - build outline → documentOutline subcollection
      - update understandingStatus: completed
  → [Phase E, on-demand] Index page images → visualIndexStatus: completed
```

### Ready states and UI labels

| Condition | UI label |
|-----------|----------|
| extraction + chunking + embedding all completed; understanding not_started | `Ready — building outline…` |
| understanding also completed | `Ready` (full smart tutoring available) |
| understanding failed | `Ready — outline unavailable` (falls back to semantic retrieval) |
| only extraction completed, chunking pending | `Processing…` |
| any status failed | `Failed — Retry` |

**Key principle:** The file is useful for learning as soon as `embeddingStatus === completed`.
Understanding is an enhancement — its absence degrades quality but does not block use.

### Status transitions

```
understandingStatus:
  not_started
    → pending (when embedding completes and understanding job is triggered)
    → completed (on success)
    → failed (on error — does not block file use)

visualIndexStatus:
  not_started
    → skipped (default for all files until Phase E)
    → pending (when triggered on-demand)
    → completed
    → failed
```

---

## 5. Implementation Phases

### Phase A — Design and schema only

- Write this design document.
- Define TypeScript types for all new records.
- Add `understandingStatus` and `visualIndexStatus` fields to `UploadedFileRecord` type and Firestore schema.
- Add to `updateUploadedFile` pick list.
- Add to API response schemas.
- No runtime behavior changes beyond status field availability.
- UI shows "building outline…" when `understandingStatus === not_started` and embedding is done.

**Gate:** Phase B does not start until Phase A types are reviewed and merged.

### Phase B — Page-level text preservation

- Modify the extraction route/service to split raw extracted text by page.
- Store one `PageRecord` per page in the `pages` subcollection.
- Preserve original page boundaries from `pdf-parse` (it provides them via `numpages` + per-page iteration).
- Store `textQuality` based on char count and ratio of recognizable characters.
- **No change** to chunking behavior — chunks remain character-window based.
- `understandingStatus` remains `not_started`.

**Risk:** `pdf-parse` may not give reliable per-page boundaries for all PDFs. Fallback: store full text as a single page record with `pageNumber: 0`.

### Phase C — Text-based document understanding

**Core work of this design. Most implementation effort.**

Trigger: `embeddingStatus === completed` → start understanding job (async, separate API call or background worker).

Steps:
1. Load full `extractedText` from `UploadedFileRecord`.
2. Run deterministic question detector (regex-based, fast, no LLM required for boundary detection).
3. Optionally: run a single small LLM call to infer `topic` and `summary` per detected question (batched, cost-controlled).
4. Store `DetectedQuestionRecord` per question.
5. Build `DocumentOutlineRecord` from question boundaries + any detected section headings.
6. Update `UploadedFileRecord.understandingStatus = "completed"`.
7. Update `UploadedFileRecord.detectedQuestionCount`.

**LLM usage is optional and bounded:**
- If `costMode === "Cheap Practice"` → skip LLM topic/summary enrichment, use deterministic text preview only.
- If `costMode === "Normal Learning"` or `"Deep Research"` → allow one batched LLM call for topic inference.
- Always run deterministic detection first, regardless of mode.

**Question detector design (deterministic core):**
```
Primary markers (high confidence):
  /^שאלה\s+\d+/m          Hebrew numbered question
  /^תרגיל\s+\d+/m         Hebrew exercise
  /^Question\s+\d+/im      English
  /^Exercise\s+\d+/im      English
  /^Problem\s+\d+/im       English
  /^\d+\.\s+\S/m           Numbered (1. 2. 3.)

Secondary markers (medium confidence):
  /^[אבגדהוזחטי]\.\s/m    Hebrew letter sequence
  /^\([אבגדהוזחטי]\)/m    Hebrew letter in parentheses
  /^[a-e]\.\s/im           English sub-letter

Context heuristics:
  - two primary markers with gap >= 80 chars → likely two separate questions
  - math block ($$ ... $$) immediately following a marker → question includes it
  - consecutive markers with gap < 30 chars → subsection, not new question
```

**Phase C does NOT implement:**
- OCR
- visual analysis
- table extraction
- figure detection

**Phase C replaces** `fileInventoryService.ts` regex scanning as the primary inventory path. The regex scanner becomes the fallback when `understandingStatus !== completed`.

### Phase D — Tutor integration

Update `sessionMessageApiService.ts` routing:

For `file_content_inventory`:
1. Check `understandingStatus === completed` for the target file.
2. If yes → read `detectedQuestions` collection → format and return.
3. If no → fall back to current `fileInventoryService.buildFileInventory()` (regex scanning).

For `specific_file_question`:
1. Classify as specific (already done by classifier).
2. Try to resolve question label from `detectedQuestions` (e.g. find `questionNumber === 3`).
3. If resolved → retrieve only `sourceChunkIds` from that question → grounded model call.
4. If not resolved → fall back to semantic retrieval with full query.

For `file_summary_request`:
1. If `understandingStatus === completed` → pass `documentOutline` title + section list as structured context.
2. Otherwise → retrieve top-K chunks by semantic search.

### Phase E — Vision on-demand (future, not now)

**Not implemented in this round. Planned only.**

Trigger: user asks `visual_reference_request` AND relevant page is identified.

Steps:
1. Identify relevant page: from outline `pageStart` of the most recently discussed question, OR from question context in conversation history.
2. Fetch page image from Storage (if `visualIndexStatus === completed`) OR generate on-demand from PDF (if compute budget allows).
3. Send page image + user question to Gemini Vision API.
4. Return Vision response with citation: "תשובה על סמך ניתוח חזותי של עמוד N."

**Cost control for Phase E:**
- Never generate page images for all pages at upload time.
- Generate only the specific page requested.
- Cache generated page images in Storage under `pages/page_{N:04d}.jpg`.
- Vision calls are gated by `costMode`: not allowed in `Cheap Practice`.

---

## 6. Failure Cases and Safeguards

| Case | Expected behavior |
|------|------------------|
| Bad PDF extraction (garbled text) | `textQuality: "poor"`. Understanding runs but confidence will be low. Detector finds fewer questions. `understandingStatus: completed` with `confidence: "low"`. Tutor notes best-effort. |
| Hebrew text order issues (RTL/LTR mixing) | Patterns match regardless of visual order (PDF text streams usually have correct logical order even when visual is RTL). If detection fails, fallback to regex scanning. |
| Math symbols corrupted by pdf-parse | Math blocks extracted as partial/garbled LaTeX. Question boundaries still detectable by label pattern. Math content retrieval works via semantic embedding (embeddings tolerate noise better than regex). |
| Multiple files in workspace | Inventory and resolution always target one file at a time. When user asks "שאלה 3" without specifying a file, classifier returns `ambiguous_file_reference` → ask clarification if multiple ready files exist. |
| Old files without `understandingStatus` | Field defaults to `"not_started"`. No automatic re-run. Show "Ready — building outline…" only if triggered explicitly or by a background job. |
| Very long files (>200 pages, >300K chars) | Process understanding in 10-page windows. Store intermediate state. `understandingStatus: "pending"` until all windows are done. |
| Diagrams with no adjacent text | Page image stored (Phase E). Text-based detection reports nothing for that page. Visual handler provides the answer. |
| Tables | Detected as question content if adjacent to a question label. Table cells may be garbled. `extractionNotes: "table detected — formatting may be degraded"`. |
| Scanned PDFs (image-only) | pdf-parse produces empty or near-empty text. `textQuality: "poor"`. `understandingStatus: failed` with `understandingErrorCode: "no_extractable_text"`. UI shows "Re-upload with text layer or use OCR (not yet supported)". |
| Malformed question numbering | "שאלה א" or "Q.3" — medium-confidence patterns catch these. `confidence: 0.5–0.7`. Stored with note. |
| Duplicate question labels | Both stored. `label: "שאלה 3"` may appear twice if detection finds an accidental repeat. `extractionNotes: "duplicate label — may be sub-question or detection error"`. Tutor returns both in inventory. |
| Extraction misses page boundaries | Fallback: treat whole document as one page. Page-level features unavailable. Understanding still runs on full text. |

---

## 7. Cost Control

### Default behavior (all modes)

- **Never run Vision by default.** Vision is opt-in per request.
- **Never LLM-process the full file text at once.** Process in page or section windows.
- Understanding job runs once per file, after embedding completes. Not re-run unless extraction changes.
- Deterministic detection (regex) runs in O(n) time with n = text length. No API call required.

### LLM usage for topic/summary enrichment

| Cost mode | LLM enrichment |
|-----------|---------------|
| Cheap Practice | Disabled. Deterministic labels only. |
| Normal Learning | One batched call: all detected questions → topic + summary. Max 40 questions per batch. |
| Deep Research | Same as Normal Learning. |

Topic/summary enrichment uses a small, cheap model call (not the full tutor model).
It is bounded: if >40 questions detected, batch is split into 40-question windows processed serially.

### Caching and recompute

- `detectedQuestions` and `documentOutline` are cached in Firestore permanently.
- Recompute only when:
  - `extractionStatus` transitions from completed to any other value (re-extraction).
  - User explicitly triggers "Recompute outline" action (future UI).
- `visualIndexStatus` page images are cached in Storage. Never deleted automatically.

### Page image sizing (Phase E)

- JPEG, 72 DPI, quality 70. Typical size: 80–150 KB per page.
- Only the specific page requested is generated.
- Maximum image size for Vision API: 4 MB (well within range at 72 DPI).

---

## 8. Test Plan

### Unit tests (before implementation)

**Question detector:**
- Clean Hebrew numbered questions → all detected, correct boundaries.
- Messy extracted text with OCR artifacts → primary patterns still match.
- English numbered exercises → detected.
- Subsection markers inside questions (א/ב) → nested correctly.
- Continuous prose (no markers) → zero detections, no false positives.
- Two markers < 30 chars apart → treated as subsection, not new question.
- Math block immediately after question label → included in that question's span.
- Very long file (300K chars) → does not stack overflow or time out.

**Artifact removal (text cleaning):**
- Page headers/footers removed (repeated line patterns).
- Page numbers removed.
- Watermark text removed.
- Ligature/encoding artifacts normalized.
- LaTeX/math blocks preserved.
- Hebrew-English mixed text preserved.

**Outline builder:**
- Linear numbered questions → flat outline with N sections.
- Questions with subsections → nested structure.
- Missing question 2 in sequence → gap preserved, not filled.
- Document title detection from first non-blank line.

**Response formatting:**
- Inventory from `detectedQuestions` → structured numbered list, not raw text.
- Inventory from fallback (no understanding) → regex-based, labeled as best-effort.
- No refusal text in either path.

### Integration tests

- Uploaded file with `understandingStatus === completed` → `GET detectedQuestions` returns questions.
- Tutor receives "איזה שאלות יש בקובץ?" → reads `detectedQuestions`, not chunk scan.
- Tutor receives "תסביר שאלה 3" → `detectedQuestions.questionNumber === 3` resolves, correct chunks retrieved.
- File with `understandingStatus === failed` → falls back to semantic retrieval + regex scan.
- Old file without `understandingStatus` field → treated as `not_started`, fallback used.

### Browser smoke

1. Upload PDF with clear question numbering.
2. Wait until `embeddingStatus === completed`. Confirm "Ready" status.
3. (After Phase C) Wait until `understandingStatus === completed`.
4. Ask "איזה שאלות יש בקובץ?" → clean structured list from `detectedQuestions`.
5. Ask "תסביר לי שאלה 3" → answer from correct chunks, not random semantic matches.
6. Ask "מה רואים בגרף?" → visual limitation message (Phase D), or Vision answer (Phase E).
7. Refresh page → file remains Ready, outline intact.

---

## 9. Migration Plan

### New files (after Phase C deployed)

Understanding job runs automatically after `embeddingStatus === completed`.
`understandingStatus` transitions: `not_started → pending → completed`.

### Existing files (before Phase C)

Files already in Firestore have `understandingStatus` absent or `"not_started"`.
**No automatic re-run.** Understanding does not run retroactively.
These files remain on the fallback path (semantic retrieval + regex scan).
UI shows nothing special for old files — no "building outline" message.

Optional future: add "Recompute outline" button in file panel for user-triggered re-run.

### Failed understanding

`understandingStatus === "failed"` with `understandingErrorCode`.
File is still usable via fallback.
User can retry via "Recompute outline" button (future UI) or by re-uploading.

### Priority for re-run

If a batch re-run job is implemented in the future:
1. Files with `chunkCount > 0` and `understandingStatus === "not_started"` — recently processed files.
2. Most recently uploaded first.
3. Files with `textQuality === "poor"` are deprioritized (low expected benefit).

---

## 10. Recommendation

### What to implement first

**Phase A (types + schema):** Immediately — low risk, enables all other phases.
Add `understandingStatus`, `visualIndexStatus`, `pageCount`, `detectedQuestionCount`, `outlineTitle` to the type system and Firestore schema. No behavior changes. This unblocks Phase C implementation without touching runtime logic.

**Phase C (text-based understanding) before Phase B (page-level storage):**
Page-level storage (Phase B) requires changes to the extraction pipeline, which is higher-risk.
Phase C (question detection) can run on the full `extractedText` already stored, with no pipeline change.
Phase C unblocks the most valuable user-facing capability (inventory, question resolution).
Phase B adds precision (accurate page numbers) but is not required for Phase C to work.

**Order:** Phase A → Phase C → Phase B → Phase D → Phase E.

### What to postpone

- Phase B (page-level storage): after Phase C.
- Phase D (full tutor integration with `detectedQuestions`): after Phase C is validated.
- Phase E (Vision): after Phase D is stable. No timeline.
- OCR: not in scope.
- Visual PDF understanding (diagrams in real time): not in scope.

### Which current code to keep

| File | Keep / Replace / Downgrade |
|------|---------------------------|
| `src/server/tutor/requestClassifier.ts` | **Keep.** Routing logic is correct. |
| `src/server/tutor/fileInventoryService.ts` | **Downgrade to fallback.** Keep as fallback path when `understandingStatus !== completed`. Do not improve its regex further. |
| `src/server/workspaces/sessionMessageApiService.ts` | **Keep routing structure.** Update `file_content_inventory` handler in Phase D to prefer `detectedQuestions` over regex scan. |
| `src/server/tutor/teachingContract.ts` | **Keep.** File access awareness section is correct. |
| Existing chunking/embedding pipeline | **Keep unchanged.** Chunks are still the retrieval unit. Document understanding reads chunk IDs — it does not replace chunks. |

### Current branch push decision

**PUSH CONDITIONAL with one caveat:**

The `file_content_inventory` shortcut in the current branch produces poor-quality output because it runs regex over raw chunks. Before pushing:

**Option A (recommended):** Neutralize the inventory shortcut output quality issue before push by adding a clear best-effort disclaimer in `formatFileInventoryResponse`:
> "זיהוי השאלות הוא ניסיוני ועלול להיות חלקי. שיפור מבוסס-מסמך יתווסף בגרסה הבאה."

This is honest, doesn't break anything, and correctly sets expectations.
The current regex scan remains as the implementation, labeled explicitly as provisional.

**Option B:** Remove the inventory shortcut entirely before push, have the model answer inventory questions via grounding (as before). Worse model behavior, but cleaner code surface for the next phase.

**Recommendation: Option A.** Push with the provisional disclaimer. The routing layer (`requestClassifier`, the deterministic shortcuts) is the correct infrastructure investment. The inventory output quality will be replaced in Phase C. Labeling the output as provisional is correct and honest.

**Do not push Phase E planning into the codebase yet.** Keep Vision as design-only until Phase D is complete.

---

*Document created: 2026-05-20*
*Next review: after Phase C implementation.*
