# MVP Implementation Checklist

## מטרת המסמך

צ׳קליסט שלבי לבניית ה־MVP.

לא מדלגים קדימה. כל שלב צריך להיבדק לפני שעוברים לשלב הבא.

---

## Phase 0 — Project setup

### 0.1 Create project folder

Create a folder named:

```text
personal-adaptive-academic-tutor
```

Put all project docs inside:

```text
/docs
```

Expected:

```text
/docs/01_Product_Requirements_v0.2.md
/docs/02_Stitch_UI_Prompt_and_Design_Requirements.md
...
```

### 0.2 Create repo

Create a GitHub repo or local project.

Recommended name:

```text
personal-adaptive-academic-tutor
```

### 0.3 Define MVP rule

Write this in the repo README:

```text
MVP goal: desktop-first Hebrew RTL tutor workspace with user-managed workspaces, PDF/DOCX upload, learner memory, academic knowledge base, retrieval routing, cost modes, decision log, and behavior tests.
```

---

## Phase 1 — UI design with Stitch

### 1.1 Open Stitch

Use `02_Stitch_UI_Prompt_and_Design_Requirements.md`.

Paste the main Stitch prompt.

### 1.2 Review generated UI

Check:

```text
Desktop-first
Hebrew RTL
Workspace navigation
Tutor conversation
Document/context panel
File library
Memory viewer
Decision log hidden
Settings/provider screen
Behavior tests screen
No gamification
```

### 1.3 Fix common issues

If needed, use follow-up prompts from the Stitch document.

### 1.4 Export or copy design/code

Save generated assets or code into:

```text
/design/stitch-output
```

---

## Phase 2 — Build shell in Google AI Studio

### 2.1 Open Google AI Studio Build Mode

Use `03_Google_AI_Studio_Build_Prompt.md`.

Paste the main build prompt.

### 2.2 Verify shell

Check:

```text
Main Tutor Workspace exists
Workspace Manager exists
File Library exists
Learner Memory Viewer exists
Decision Log exists
Settings exists
Behavior Test Screen exists
```

### 2.3 Fix if needed

Use correction prompts from the AI Studio document.

---

## Phase 3 — Data models

### 3.1 Add TypeScript models

Required models:

```text
Workspace
UploadedFile
LearnerMemory
AcademicKnowledgeItem
Session
SessionSummary
AdaptiveInstruction
DecisionLogEntry
BehaviorTest
ProviderSettings
TutorResponse
TutorInternalUpdate
```

### 3.2 Validate separation

Check:

```text
LearnerMemory is not stored as AcademicKnowledgeItem.
AcademicKnowledgeItem is not stored as learner preference.
```

---

## Phase 4 — Backend route

### 4.1 Add /api/tutor/respond

Input:

```text
userId
sessionId
workspaceId
userMessage
workMode
costMode
```

Output:

```text
visible_response
internal_update
```

### 4.2 Mock response first

Before connecting Gemini, return a mock response.

Expected:

```text
Frontend sends message.
Backend returns valid structured JSON.
Decision Log records request.
```

---

## Phase 5 — Gemini integration

### 5.1 Add Gemini provider

Server-side only.

No API keys in frontend.

### 5.2 Add structured output validation

If invalid:

```text
retry once
fallback safely
log failure
```

### 5.3 Add tutor core prompt

Use prompt from `05_Gemini_API_Integration_Spec.md`.

---

## Phase 6 — Tutor behavior rules

### 6.1 Add deterministic intent detection

Test phrases:

```text
רק כיוון
אל תפתור
רק תשובה
פתרון מלא
למה
איך יודעים
איפה מכניסים
```

### 6.2 Add server-side guardrails

Check:

```text
no solving during guidance-only
stop after local question
no unrequested practice
no formula-first new topic
no confident guessing
```

---

## Phase 7 — Workspaces

### 7.1 Create workspace

Example:

```text
פיזיקה 2
```

### 7.2 Move workspace

Move to:

```text
שנה א / סמסטר ב / פיזיקה 2
```

Expected:

```text
workspace_id unchanged
currentPath updated
previousPaths updated
linked files/sessions/memory preserved
```

---

## Phase 8 — File upload

### 8.1 Upload PDF/DOCX

Expected:

```text
file appears in File Library
workspace_id attached
status = uploaded
```

### 8.2 Classify file

Expected:

```text
topic suggested
confidence shown
asks Nevo if uncertain
```

### 8.3 Index file

Expected:

```text
status = indexing
then status = indexed or failed
Decision Log updated
```

---

## Phase 9 — Summaries

### 9.1 Generate file summary

Expected:

```text
summary saved
linked to file
```

### 9.2 Generate topic/workspace summary

Expected:

```text
summary saved as AcademicKnowledgeItem
retrieval prefers summary before raw chunks
```

---

## Phase 10 — Retrieval routing

### 10.1 Implement router

Inputs:

```text
user message
active workspace
work mode
cost mode
session state
```

Outputs:

```text
needs_retrieval
retrieval_scope
max_chunks
max_tokens
should_ask_clarification_first
```

### 10.2 Test router

Cases:

```text
Simple fact → no retrieval
Broad question → ask clarification
Active file question → active file/workspace retrieval
Cheap Practice → minimal retrieval
Deep Research → broader retrieval
```

---

## Phase 11 — Memory

### 11.1 Add memory candidate detection

Detect:

```text
preference
difficulty
correction
explanation pattern
pacing
behavior rule
```

### 11.2 Add memory write policy

Rules:

```text
high confidence small update → save
medium/low confidence → ask
contradiction → ask
important deletion/archive → ask
```

### 11.3 Add Memory Viewer

Expected:

```text
view memory
edit memory
delete memory
approve/reject proposed memory
```

---

## Phase 12 — Cost modes

Add:

```text
Cheap Practice
Normal Learning
Deep Research
```

Verify each changes retrieval budget.

---

## Phase 13 — Work modes

Add:

```text
Learning
Practice
Research
Build / Project
Temporary Chat
```

Verify:

```text
Temporary Chat avoids permanent memory by default.
Practice minimizes retrieval.
Research allows web.
Build supports project context.
```

---

## Phase 14 — Web search

MVP:

```text
Google Search Grounding
```

Verify:

```text
web search only when justified
web search is disclosed
Decision Log records it
conflicts are shown, not silently resolved
```

---

## Phase 15 — Behavior tests

Add tests:

```text
Guidance only does not solve
Local question stops
Broad query asks to narrow
Simple fact avoids retrieval
Context-only file does not trigger solving
User correction wins
Web search disclosed
PDF source/page shown when relevant
```

Run all tests before calling MVP stable.

---

## Phase 16 — MVP smoke test

Run full scenario:

```text
1. Create workspace פיזיקה 2
2. Upload PDF
3. Confirm file assignment
4. Ask guidance-only question
5. Ask local conceptual question
6. Verify tutor stops
7. Check memory update
8. Check decision log
9. Switch Cheap Practice mode
10. Verify retrieval budget changes
```

---

## MVP complete only if

```text
Tutor follows instruction files.
Tutor does not rush.
Tutor supports workspaces.
Tutor supports PDF/DOCX.
Tutor has separate Learner Memory and Academic Knowledge Base.
Tutor uses retrieval routing.
Tutor has cost modes.
Tutor has hidden Decision Log.
Tutor has behavior tests.
No API keys are exposed.
```
