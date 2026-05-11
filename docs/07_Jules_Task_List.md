# Jules Task List

## מטרת המסמך

מסמך זה מיועד ל־Jules או לכל coding agent אחר שעובד על GitHub repo.

אין לתת ל־Jules משימה עמומה כמו:

```text
Build my tutor app.
```

צריך לתת משימות קטנות, מדויקות, עם גבולות ברורים ובדיקות.

---

## General instruction to Jules

```text
You are working on the Personal Adaptive Academic Tutor project.
Do not redesign the product unless explicitly asked.
Follow the project documents.
Work in small tasks.
Do not expose API keys in frontend.
Do not remove existing behavior tests.
Keep Learner Memory separate from Academic Knowledge Base.
Preserve Hebrew RTL UI.
Prefer typed interfaces and validation.
```

---

## Task 1 — Define core TypeScript models

```text
Create TypeScript types/interfaces for:
- Workspace
- UploadedFile
- LearnerMemory
- AcademicKnowledgeItem
- Session
- SessionSummary
- AdaptiveInstruction
- DecisionLogEntry
- BehaviorTest
- ProviderSettings
- TutorResponse
- TutorInternalUpdate

Add these in a central /src/types or /src/lib/types folder.
Do not implement UI changes in this task.
Add basic unit tests or type validation if the project uses a validation library.
```

Acceptance:

```text
Types compile.
No UI changed.
No API key touched.
```

---

## Task 2 — Implement workspace model and UI wiring

```text
Implement user-managed workspaces.

Features:
- create workspace
- rename workspace
- move workspace under folder/path
- archive workspace
- preserve stable workspace_id
- update currentPath and previousPaths

Workspace path must be metadata, not identity.
```

Acceptance:

```text
Moving workspace does not change workspace_id.
Files/sessions linked by workspace_id remain linked.
UI shows current path.
```

---

## Task 3 — Add tutor response API route

```text
Create /api/tutor/respond.

Input:
- userId
- sessionId
- workspaceId
- userMessage
- workMode
- costMode

Output:
- visible_response
- internal_update

For now, return a mocked structured response if Gemini is not configured.
Add validation for request and response.
```

Acceptance:

```text
Frontend can send message.
Backend returns structured JSON.
Decision Log entry is created.
```

---

## Task 4 — Add Gemini ModelProvider

```text
Implement a GeminiModelProvider behind the ModelProvider interface.

Do not call Gemini directly from UI.
Use server-side environment variable for API key.
Support structured output.
Retry once on invalid JSON.
Return safe fallback if retry fails.
```

Acceptance:

```text
No API key in frontend.
Invalid structured output is handled.
Tutor route uses provider interface.
```

---

## Task 5 — Implement intent detection rules

```text
Add deterministic intent detection before model call.

Rules:
- "רק כיוון" / "אל תפתור" → guidance_only
- "רק תשובה" / "בלי דרך" → final_answer_only
- "פתרון מלא" → full_solution
- local conceptual triggers: למה, איך יודעים, איפה מכניסים, מה המשמעות, למה מותר

If deterministic detection is uncertain, allow model classification.
```

Acceptance:

```text
Unit tests pass for Hebrew trigger phrases.
Guidance-only is detected reliably.
Local conceptual questions are detected reliably.
```

---

## Task 6 — Enforce tutor guardrails server-side

```text
Add server-side guardrails after model response.

Check:
- Did tutor solve when guidance_only?
- Did tutor continue after local question?
- Did tutor add unrequested practice?
- Did tutor open new topic with formula?
- Did tutor guess unclear data?

If violation detected, repair response or return safe fallback.
```

Acceptance:

```text
Behavior tests catch violations.
Guardrails run server-side.
```

---

## Task 7 — Implement Decision Log

```text
Create DecisionLogEntry storage and hidden UI.

Log:
- retrieval scope
- web search use
- memory write
- memory not written
- file assignment
- file indexing
- topic classification
- clarification question
- model/provider selection
- cost mode selection
- failures/fallbacks

Language: technical English.
```

Acceptance:

```text
Decision Log is hidden from main UI.
Entries are visible in advanced/debug screen.
```

---

## Task 8 — Implement Learner Memory storage

```text
Create learner memory storage and viewer.

Features:
- list memories
- edit memory
- delete memory
- mark memory as wrong
- approve/reject proposed memory

Memory statuses:
active, tentative, superseded, archived, deleted.
```

Acceptance:

```text
Learner Memory is separate from Academic Knowledge Base.
User can edit/delete memory.
```

---

## Task 9 — Implement file upload metadata flow

```text
Add PDF/DOCX upload flow.

For each file:
- upload to storage
- create UploadedFile metadata
- status: uploaded
- assign to active workspace by default
- ask user before permanent knowledge base save in early stage
- show indexing status
```

Acceptance:

```text
PDF/DOCX appears in File Library.
File has workspace_id.
File has status.
No indexing assumed before completion.
```

---

## Task 10 — Implement file classification flow

```text
Create classifyUploadedFileFlow.

Input:
- file preview
- active workspace
- existing topics/files

Output:
- detected course/topic/subtopic
- file policy
- assignment status
- duplicate candidates
- confidence
- shouldAskNevo
```

Acceptance:

```text
Low confidence asks user.
User correction wins.
Duplicate candidates shown.
```

---

## Task 11 — Implement RetrievalProvider abstraction

```text
Create RetrievalProvider interface.
Implement GeminiFileSearchProvider stub or real integration if API key/config exists.

Methods:
- search
- indexFile
- deleteFile
- updateMetadata
```

Acceptance:

```text
Tutor code depends on RetrievalProvider interface, not concrete provider.
```

---

## Task 12 — Implement retrieval router

```text
Create retrieval router.

Inputs:
- user message
- active workspace
- work mode
- cost mode
- session state

Output:
- needs_retrieval
- retrieval_scope
- max_chunks
- max_tokens
- use_summaries_first
- web_search_allowed
- should_ask_clarification_first
```

Acceptance:

```text
Simple questions return needs_retrieval=false.
Broad questions return should_ask_clarification_first=true.
Cheap Practice Mode reduces budget.
```

---

## Task 13 — Implement summaries

```text
Add summary generation flows:
- file summary
- topic summary
- workspace summary
- learner progress summary

Store summaries as AcademicKnowledgeItem or SessionSummary.
```

Acceptance:

```text
Summaries are stored.
Retrieval prefers summaries before raw chunks.
```

---

## Task 14 — Implement cost modes

```text
Add cost mode behavior:
- Cheap Practice
- Normal Learning
- Deep Research

Cost mode affects retrieval budget, web search permission, raw chunk use, and future model selection.
```

Acceptance:

```text
Switching cost mode changes retrieval router output.
```

---

## Task 15 — Implement work modes

```text
Add mode selector and behavior mapping:
- Learning
- Practice
- Research
- Build / Project
- Temporary Chat

Temporary Chat should not automatically write permanent memory/knowledge.
Practice should minimize retrieval.
Research should allow broader retrieval/web.
```

Acceptance:

```text
Mode is sent to backend.
Backend uses mode in routing.
```

---

## Task 16 — Implement Behavior Test Screen

```text
Create hidden Behavior Test Screen.

Tests:
- guidance only does not solve
- local question answers and stops
- broad question asks clarification
- context-only file does not trigger solving
- simple fact avoids retrieval
- user correction wins
- web search disclosure
- PDF source/page display when relevant
```

Acceptance:

```text
Tests can run.
Pass/fail visible.
Failures include expected vs actual.
```

---

## Task 17 — Add WebSearchProvider abstraction

```text
Create WebSearchProvider interface.
Implement GoogleSearchGroundingProvider placeholder/wrapper.
Do not implement Tavily yet unless configured.
Add future Tavily slot.
```

Acceptance:

```text
Web search calls are behind provider interface.
Web search is logged.
Tutor says when web search was used.
```

---

## Task 18 — Add provider settings UI

```text
Create Settings / Provider Settings screen.

Show:
- default model provider
- retrieval provider
- web search provider
- cost modes
- API key status only, not raw key
- future provider placeholders
```

Acceptance:

```text
No secrets shown.
Settings are clear.
```

---

## Task 19 — Add security review

```text
Review frontend for exposed secrets.
Review database access patterns.
Ensure userId scoping.
Ensure file access scoping.
```

Acceptance:

```text
No API keys in frontend.
No cross-user data access.
```

---

## Task 20 — Final MVP smoke test

```text
Run complete scenario:
1. Create workspace פיזיקה 2
2. Upload PDF
3. Classify file
4. Ask tutor guidance-only question
5. Ask local conceptual question
6. Check memory update
7. Run behavior tests
8. Check Decision Log
```

Acceptance:

```text
All steps work without manual database edits.
```
