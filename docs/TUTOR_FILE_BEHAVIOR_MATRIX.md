# Tutor File Behavior Matrix

**Scope: text-based only (extracted text / chunks inventory). No OCR. No Vision.**

This document defines how the tutor routes and responds to file-related requests.
It is a permanent design note — update it when routing or behavior changes.

---

## Request Classification

The `classifyTutorRequest()` function in `src/server/tutor/requestClassifier.ts`
classifies every incoming message before the model is called.

Classification happens in priority order:
1. Visual reference (overrides inventory framing)
2. File content inventory
3. File access status
4. File summary request
5. Specific file question
6. Ambiguous file reference
7. General tutor question (default)

---

## Intent Matrix

### 1. `file_access_status`

**What it is:** User asks whether the tutor can see/access/read an uploaded file.

**Examples:**
- "אתה רואה את הקובץ?"
- "יש לך גישה ל-PDF?"
- "האם הקובץ נטען?"
- "can you see the PDF?"

**Handler:** Deterministic — reads real Firestore file state. Model NOT called.

**Response rules:**
- If ready files exist → "כן, אני יכול להשתמש בטקסט שחולץ מהקבצים..." + file list + visual limitation note
- If processing → "הקובץ עדיין בעיבוד..."
- If no files → "לא נמצאו קבצים..."
- Never claim visual PDF access.
- Visual limitation note at end (not as main message).

**shouldAnswerFromSystemState:** true

---

### 2. `file_content_inventory`

**What it is:** User asks the tutor to list/enumerate questions, exercises, or sections from a file.

**Examples:**
- "איזה שאלות אתה יכול לראות בקובץ?"
- "איזה שאלות יש בקובץ?"
- "איזה תרגילים יש במטלה?"
- "תן לי רשימת שאלות מהקובץ"
- "what questions are in the file?"
- "list the exercises in the file"

**Handler:** Deterministic — loads all chunks from the first ready file in document order, scans for question/exercise section boundaries, returns best-effort structured list. Model NOT called.

**Response rules:**
- Start with: "אני עובד עם הטקסט שחולץ מהקובץ, לא עם תצוגה חזותית של ה-PDF."
- List detected sections (numbered, with short preview).
- If no structured sections found → say so, offer text-based help, do NOT refuse.
- Do NOT say "אני לא יכול לתת רשימה מסודרת".
- Do NOT say "שאל אותי שאלה ספציפית" as primary response.
- Do NOT blame missing visual PDF understanding for inability to list.
- End with invite to start from a specific question.

**shouldUseFileInventory:** true

**Section detection patterns (in `fileInventoryService.ts`):**
- `שאלה N`, `תרגיל N`, `סעיף N`, `מטלה N`
- `N. ` (Arabic numeral + period + space)
- `Question N`, `Exercise N`, `Problem N`
- `(א)`, `(ב)`, `א.`, `ב.` (Hebrew letter markers)

---

### 3. `file_summary_request`

**What it is:** User asks for a summary or overview of the file content.

**Examples:**
- "תסכם את הקובץ"
- "מה הנושאים המרכזיים במטלה?"
- "summarize the file"
- "תן לי סיכום של הקובץ"

**Handler:** Model called with retrieved chunks as grounding context.

**Response rules:**
- Use extracted text as basis.
- Summarize by topics/sections.
- Do not require a specific question.
- Do not say "I cannot summarize without visual access".

**shouldUseRetrieval:** true

---

### 4. `specific_file_question`

**What it is:** User asks about a specific numbered question, exercise, or section.

**Examples:**
- "תסביר לי שאלה 3"
- "מה כתוב בשאלה על קיבול?"
- "איך פותרים את הסעיף הראשון?"
- "help me with question 3"

**Handler:** Model called with retrieved chunks as grounding context. Semantic retrieval for the specific question content.

**Response rules:**
- Answer as a tutor (explain, guide, or solve depending on work mode).
- Cite sources in collapsible Sources section.
- If multiple files may match, ask short clarification.

**shouldUseRetrieval:** true

---

### 5. `visual_reference_request`

**What it is:** User asks about a visual element in the file (graph, diagram, circuit, figure, image).

**Examples:**
- "מה רואים בגרף?"
- "תסביר את המעגל בתמונה"
- "מה מופיע באיור?"
- "מה רואים בגרף בעמוד 2?"
- "describe the circuit in the figure"

**Handler:** Deterministic — visual PDF understanding is not active. Model NOT called.

**Response rules:**
- State clearly: visual PDF understanding is not yet implemented.
- Offer text-based fallback: if extracted text describes the figure, offer to help from text.
- Do NOT pretend to see the image.
- Precise wording: "כרגע אני לא מנתח חזותית גרפים, מעגלים, תרשימים, או תמונות מתוך PDF. ניתוח חזותי יתווסף בשלב נפרד."

**shouldUseRetrieval:** false

---

### 6. `ambiguous_file_reference`

**What it is:** Short message that references a file but intent is unclear.

**Examples:**
- "מה יש שם?"
- "תסביר את זה"

**Handler:** If one Ready file is the current context → use it. If multiple possible → ask short clarification.

**Response rules:**
- If one current/recent Ready file → infer context, use it.
- If multiple → ask one short clarification question.
- Do NOT give generic capability disclaimers.

---

### 7. `general_tutor_question`

**What it is:** No file-specific intent detected. Standard academic question.

**Examples:**
- "מה הנגזרת של sin(x)?"
- "תסביר לי אינטגרציה בהצבה"
- "explain electric potential"

**Handler:** Model called with standard retrieval decision (may or may not retrieve).

---

## Routing Decision Table

| Intent | shouldAnswerFromSystemState | shouldUseFileInventory | shouldUseRetrieval | Model called |
|--------|---------------------------|----------------------|-------------------|--------------|
| file_access_status | ✓ | — | — | NO |
| file_content_inventory | — | ✓ | — | NO |
| file_summary_request | — | — | ✓ | YES |
| specific_file_question | — | — | ✓ | YES |
| visual_reference_request | — | — | — | NO |
| ambiguous_file_reference | — | — | — | conditional |
| general_tutor_question | — | — | — | YES |

---

## Forbidden Response Patterns

These patterns are forbidden regardless of routing:

| Pattern | Why forbidden |
|---------|--------------|
| "אין לי גישה ישירה לקבצים שאתה מעלה" | Factually wrong — tutor has extracted text and chunks |
| "אני לא יכול לתת רשימה מסודרת" | Inventory shortcut provides best-effort list |
| "שאל אותי שאלה ספציפית" (as refusal to inventory) | Inventory request deserves inventory response |
| "אני לא יכול לראות את תוכן ה-PDF" | Tutor has extracted text |
| Exposing chunk IDs or source JSON in the answer body | Sources belong in collapsible Sources UI only |
| "I can see textual content but not the visual structure" (when refusing inventory) | Text structure IS parseable from extracted text |

---

## Visual Limitation Wording

**Correct:**
> "כרגע אני לא מנתח חזותית גרפים, מעגלים, תרשימים, או תמונות מתוך PDF. ניתוח חזותי יתווסף בשלב נפרד."

**Only state when:**
- User explicitly asks about a graph, diagram, circuit, figure, or image.
- At end of a `file_access_status` response (as a footnote).

**Never state:**
- As a reason to refuse listing questions/exercises.
- As a reason to refuse summarizing.
- As the opening of a response when the question is not visual.

---

## Implementation Files

| File | Role |
|------|------|
| `src/server/tutor/requestClassifier.ts` | `classifyTutorRequest()` — intent + routing flags |
| `src/server/tutor/fileInventoryService.ts` | `buildFileInventory()` + `formatFileInventoryResponse()` |
| `src/server/workspaces/sessionMessageApiService.ts` | Routing dispatch — uses classifier before model call |
| `src/server/tutor/teachingContract.ts` | `TUTOR_TEACHING_CONTRACT` — File Access Awareness section |
| `src/server/tutor/deepseekGroundingPrompt.ts` | Grounding instructions when model IS called with chunks |

---

## Future Extensions (not in this round)

- **Session-attached files**: when a file is attached to a specific conversation, prioritize its chunks in inventory + retrieval.
- **Visual PDF understanding**: when implemented, `visual_reference_request` routes to image analysis instead of the text fallback.
- **OCR**: not implemented. Do not add to this matrix until the pipeline exists.
- **Multi-file inventory**: when user asks about "all files in the workspace", scan all ready files.
