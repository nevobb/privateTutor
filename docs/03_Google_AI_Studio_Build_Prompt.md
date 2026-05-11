# Google AI Studio Build Prompt

## מטרת המסמך

מסמך זה כולל הוראות מפורטות לבניית אב־טיפוס ראשוני ב־Google AI Studio Build Mode.

המטרה היא לא לבנות את כל המוצר בבת אחת. המטרה היא לבנות MVP מספיק חכם כדי להוכיח:

1. workspaces בניהול המשתמש
2. צ׳אט מורה שמציית להוראות
3. קבצים PDF/DOCX
4. זיכרון אישי נפרד מידע אקדמי
5. retrieval ממוקד לפי workspace
6. cost modes
7. Decision Log
8. behavior tests

---

## לפני שמתחילים

ודא שיש לך:

- חשבון Google מתאים.
- גישה ל־Google AI Studio.
- Gemini API key.
- Firebase project מוכן או אפשרות ליצור אחד.
- המסמכים בתיקיית הפרויקט.

לא להכניס API keys ישירות לקוד frontend.

---

## Prompt ראשי ל־Google AI Studio

הדבק את הפרומפט הבא ב־Google AI Studio Build Mode:

```text
Build a desktop-first responsive Hebrew RTL full-stack web app called “Personal Adaptive Academic Tutor”.

The app is a private academic tutor workspace for Nevo.
It is not a generic chatbot, not a course platform, and not a gamified learning app.

Primary goal:
Create an adaptive academic tutor that supports long-term university learning, user-managed workspaces, uploaded PDF/DOCX files, learner memory, academic knowledge base, retrieval budgets, and behavior regression tests.

Technical requirements:
- Use a full-stack architecture.
- Frontend: React / TypeScript.
- Backend: server-side API routes only for model calls, retrieval, memory writes, and file indexing.
- Do not expose API keys in the frontend.
- Use Firebase Authentication placeholder or simple local user abstraction for MVP.
- Use Firestore-style data models.
- Use Firebase Storage-style file storage abstraction.
- Prepare the backend for Genkit flows, even if implemented as simple server functions first.
- Gemini-first model architecture.
- Add abstractions for future model providers, retrieval providers, and web search providers.

UI requirements:
- Hebrew RTL interface.
- Desktop-first responsive layout.
- Main screens:
  1. Main Tutor Workspace
  2. Workspace Manager
  3. File Library / Knowledge Base
  4. Learner Memory Viewer
  5. Hidden Decision Log
  6. Settings / Provider Settings
  7. Behavior Test Screen

Main Tutor Workspace must include:
- workspace navigation tree
- active workspace title
- mode selector: Learning, Practice, Research, Build, Temporary Chat
- cost mode selector: Cheap Practice, Normal Learning, Deep Research
- central tutor conversation
- PDF/DOCX upload area
- active file/context panel
- scratchpad area
- subtle memory status indicator
- hidden advanced menu

Core data models:
1. Workspace
2. UploadedFile
3. LearnerMemory
4. AcademicKnowledgeItem
5. Session
6. SessionSummary
7. AdaptiveInstruction
8. DecisionLogEntry
9. BehaviorTest
10. ProviderSettings

Tutor behavior:
The tutor must follow these rules:
- explicit user instruction always wins
- guidance only means do not solve
- local conceptual question means answer locally and stop
- do not continue solving after local question
- do not start new topic with formula
- do not ask “הבנת?” at the end
- do not suggest practice unless requested
- do not rush forward
- if unclear, ask one short clarification question

Backend behavior:
Create a /api/tutor/respond route that receives:
- user message
- active workspace
- selected work mode
- selected cost mode
- current session state
- relevant learner memory
- relevant retrieved context

The route returns structured JSON:
{
  "visible_response": "Hebrew tutor response",
  "internal_update": {
    "detected_intent": "...",
    "should_stop_progression": true,
    "retrieval": {...},
    "learner_memory_update": {...},
    "knowledge_base_action": {...},
    "decision_log_entries": []
  }
}

If structured output is invalid:
- retry once with a repair prompt
- if still invalid, return a safe fallback response

Retrieval logic:
- Do not retrieve for simple questions if confident.
- Use active workspace as default retrieval scope.
- Broad questions should trigger clarification before broad retrieval.
- Cheap Practice Mode should minimize retrieval.
- Normal Learning Mode should use workspace-scoped retrieval.
- Deep Research Mode may use broader retrieval and web search.

File upload logic:
- Support PDF and DOCX.
- Store file metadata.
- Ask before saving file to permanent knowledge base in early stage.
- If file assignment is uncertain, ask Nevo.
- Create a file summary.
- Store indexing status.

Decision Log:
Create a hidden technical Decision Log in English.
Log retrieval decisions, memory writes, file assignment decisions, web search decisions, cost mode choices, and fallback events.

Behavior Test Screen:
Create tests for:
- “רק כיוון” must not solve
- “למה?” must answer locally and stop
- broad question must ask to narrow before expensive retrieval
- context-only file must not trigger solving
- simple fact must avoid retrieval if confident
- user correction must win

Do not implement native mobile app.
Do not implement voice/live tutor.
Do not implement OCR-heavy workflows.
Do not implement many model providers yet.
Create clean, modular code with clear placeholders for future integrations.
```

---

## שלב בדיקה אחרי יצירת האפליקציה

לא ממשיכים לפני שבודקים:

```text
האם הממשק RTL?
האם יש workspaces?
האם יש mode selector?
האם יש cost mode selector?
האם יש צ׳אט מורה?
האם יש File Library?
האם יש Learner Memory Viewer?
האם יש Decision Log מוסתר?
האם יש Behavior Test Screen?
האם אין gamification?
האם API keys לא מופיעים ב-frontend?
```

---

## תיקונים אם AI Studio יוצר משהו לא נכון

### אם נוצר צ׳אט פשוט מדי

```text
This is too close to a generic chatbot. Add workspace management, file library, learner memory viewer, decision log, cost modes, and behavior tests. The product is a tutor workspace, not only chat.
```

### אם חסר RTL

```text
Convert the entire UI to Hebrew RTL. All layout, navigation, labels, forms, and reading flow should be RTL-first.
```

### אם חסר backend אמיתי

```text
Add server-side API routes. Model calls, retrieval, memory writes, and file indexing must happen server-side. Do not expose API keys in the frontend.
```

### אם אין הפרדה בין memory ל־knowledge

```text
Separate Learner Memory from Academic Knowledge Base. Learner Memory stores information about Nevo and how to teach him. Academic Knowledge Base stores course files, summaries, topics, and sources.
```

### אם אין behavior tests

```text
Add a hidden Behavior Test Screen with regression tests for tutor behavior: guidance only, local question stop, broad query clarification, simple fact no retrieval, user correction wins.
```

### אם retrieval מופעל תמיד

```text
Add retrieval routing. The tutor must not retrieve for every message. Simple known facts should be answered without retrieval when confident. Broad questions should be decomposed before expensive retrieval.
```

---

## שלבי בנייה מומלצים בתוך AI Studio

### Iteration 1 — UI shell

Goal:

```text
Create all screens and navigation.
No real AI logic yet.
```

Check:

```text
Can create workspace.
Can switch mode.
Can switch cost mode.
Can open File Library.
Can open Memory Viewer.
Can open Decision Log.
```

### Iteration 2 — data models

Goal:

```text
Add TypeScript interfaces and mock data storage.
```

Models:

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
```

### Iteration 3 — tutor API stub

Goal:

```text
Create /api/tutor/respond with mocked model response.
```

Expected:

```text
User sends message.
Backend returns visible_response + internal_update.
Decision log entry is created.
```

### Iteration 4 — Gemini integration

Goal:

```text
Replace mocked response with Gemini API call.
Use structured output.
Validate response.
Retry once if invalid.
```

### Iteration 5 — file upload MVP

Goal:

```text
Upload PDF/DOCX.
Store metadata.
Show indexing status.
Create summary placeholder.
```

### Iteration 6 — retrieval MVP

Goal:

```text
Workspace-scoped retrieval.
Summaries first.
Simple retrieval budget.
No global search by default.
```

### Iteration 7 — behavior tests

Goal:

```text
Run behavior tests and show pass/fail.
```

---

## Minimum acceptable MVP from AI Studio

The AI Studio output is acceptable only if:

```text
It is not just a chatbot.
It has workspaces.
It has file management.
It has separate learner memory.
It has a backend route.
It separates visible_response from internal_update.
It has behavior tests.
It has decision log.
It has cost modes.
It is desktop-first Hebrew RTL.
```
