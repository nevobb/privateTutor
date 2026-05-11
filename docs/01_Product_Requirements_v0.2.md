# Personal Adaptive Academic Tutor — Product Requirements v0.2

## 0. Purpose

This document defines the product requirements for Nevo’s personal adaptive academic tutor.

The goal is not to build a generic chatbot, a course platform, or a dashboard full of features. The goal is to build a long-term academic tutor that can learn how Nevo learns, work with course materials, manage knowledge over time, and adapt its teaching behavior without becoming unstable or expensive to run.

This document is the source of truth before creating implementation prompts for Stitch, Google AI Studio, Firebase / Genkit, Gemini API, Jules, and future model/provider integrations.

---

## 1. Product vision

The tutor is a personal academic tutor for Nevo’s university studies.

It should support the entire degree over time, not only one course or one semester. It begins with Nevo’s existing tutor instruction files and gradually adapts to Nevo’s learning style, behavior, weaknesses, preferences, and academic progress.

The tutor’s highest priority is:

\[
\text{Deep understanding before progress}
\]

It must not rush to solve exercises, jump to the next topic, or push practice/questions unless Nevo explicitly asks for that. The tutor should move slowly when needed, explain step by step, and make sure the current idea is understood before progressing.

The tutor should feel like a patient, sharp, friendly, slightly cynical private tutor — not like a robotic assistant, not like customer support, and not like a learning management system.

---

## 2. Core teaching principles

The tutor must follow Nevo’s existing instruction files as locked core behavior.

Core principles:

1. Nevo’s explicit instruction always wins.
2. If Nevo asks for guidance only, the tutor must not solve.
3. If Nevo asks for a full solution, the tutor must solve step by step.
4. If Nevo asks a local conceptual question, the tutor answers locally and stops.
5. The tutor must not continue solving after answering a local conceptual question.
6. The tutor must not start a new topic with a formula.
7. The tutor must explain what is happening, then why, then how to work with it.
8. The tutor must not guess confidently when data, notation, or context is unclear.
9. The tutor must not ask “הבנת?” at the end.
10. The tutor must not add test questions or practice unless Nevo requested practice.
11. The tutor must not push Nevo back to the solution path after a local question.
12. The tutor must not become motivational filler.
13. The tutor should be direct, informal, technically clear, and slightly cynical when useful.

---

## 3. Product personality

The tutor should be patient, adaptive, friendly, direct, sharp, technically accurate, slightly cynical when useful, calm during confusion, and focused on understanding.

The tutor should not be robotic, generic, overly formal, motivational without substance, eager to finish exercises, eager to move to the next topic, noisy with unnecessary UI, or feature-heavy without purpose.

Behavior rule:

```text
If Nevo is confused, slow down.
If Nevo asks a local question, answer locally and stop.
If Nevo asks for guidance, do not solve.
If Nevo asks for full solution, solve carefully with bridges.
If Nevo is strong in a part, move faster but do not skip logic.
```

---

## 4. Platform target

The MVP should be a desktop-first responsive web app.

Primary usage is on a computer.

The interface should be optimized for desktop learning sessions with a large reading area, tutor conversation, file/context panel, workspace navigation, document preview, and optional scratchpad / working area.

Mobile is secondary. Mobile should support quick review, short questions, and checking progress, but there should be no native mobile app in the MVP.

Requirement:

```text
Desktop-first responsive web app.
Web only in MVP.
Mobile usable, but not primary.
Hebrew RTL interface.
```

---

## 5. User-managed workspaces

The app must support workspaces that Nevo creates and manages manually.

A workspace is a learning context. It can represent a course, temporary practice area, general academic area, semester folder, archive folder, or project/build area.

Example:

```text
פיזיקה 2
├── קבצי ידע
├── שיחות לימוד
├── תרגולים זמניים
├── סיכומי שיעור
├── זיכרונות רלוונטיים
└── נושאים שנלמדו
```

Later, Nevo may reorganize it:

```text
שנה א
└── סמסטר ב
    └── פיזיקה 2
```

The tutor must understand that this is the same workspace moved into a new hierarchy.

Important rule:

```text
Workspace path is metadata, not identity.
Workspace identity must be stable even if Nevo renames or moves it.
```

Each workspace must have a stable internal ID.

```json
{
  "workspace_id": "physics_2_2026_unique_id",
  "display_name": "פיזיקה 2",
  "current_path": "שנה א / סמסטר ב / פיזיקה 2",
  "previous_paths": ["פיזיקה 2"],
  "status": "active",
  "course_context": {
    "year": 1,
    "semester": 2,
    "course": "Physics 2"
  }
}
```

The active workspace is the default scope for uploaded files, tutoring sessions, memory writes, retrieval, file classification, summaries, and current academic context.

---

## 6. Workspace hierarchy

The long-term academic structure should support:

\[
\text{Year}
\rightarrow
\text{Semester}
\rightarrow
\text{Course / Workspace}
\rightarrow
\text{Topic}
\rightarrow
\text{Files / Sessions / Summaries / Memory}
\]

The system must not force Nevo to define the entire degree structure upfront.

It should allow gradual growth:

```text
Current semester first.
Future semesters later.
Archived courses later.
Temporary folders when needed.
```

---

## 7. File management

Files are managed by the app itself, not by Google Drive as the main source of truth.

The app should manage uploaded files, file metadata, workspace assignment, topic assignment, indexing status, summaries, source references, and document versions.

Recommended infrastructure:

```text
Firebase Authentication
Firestore metadata
Firebase Storage or equivalent app storage
Gemini File Search for MVP indexing/RAG
Provider abstraction for future retrieval engines
```

Supported MVP file types:

```text
PDF digital readable files
DOCX digital readable files
```

Not supported in MVP as primary targets:

```text
scanned PDFs
handwriting
unclear screenshots
heavy OCR workflows
```

Fallback rule:

```text
If file extraction confidence is low, notify Nevo and do not index it as reliable knowledge.
```

---

## 8. File ingestion policy

At the beginning of the project, the tutor should ask before saving uploaded files to the permanent knowledge base.

Over time, once the tutor becomes more reliable and learns Nevo’s patterns, it may ask less often when confidence is high.

Flow:

```text
Upload file
→ detect file type
→ extract readable content
→ classify workspace/course/topic
→ detect whether file is new, duplicate, or supplemental
→ ask Nevo if confidence is not high
→ save file metadata
→ index file
→ create file summary
→ connect to workspace/topic
```

If the tutor is unsure where a file belongs, it must ask Nevo.

If a file looks like a duplicate, the tutor asks at first. Later, it may save only if the file contains new information.

File assignment statuses:

```text
confirmed
tentative
unassigned
duplicate
superseded
archived
```

File policy values:

```text
knowledge_base_source
context_only_for_current_answer
context_for_practice_generation
temporary_reference
archive
```

Important nuance:

A file sent “for context only” may still be useful for generating future practice questions. Therefore, it should not automatically be ignored.

---

## 9. Learner Memory vs Academic Knowledge Base

The system must strictly separate:

\[
\text{Learner Memory}
\neq
\text{Academic Knowledge Base}
\]

Learner Memory stores how Nevo learns, what works, what fails, recurring difficulties, pacing preferences, user corrections, and teaching behavior rules.

Academic Knowledge Base stores PDFs, DOCX files, lecture notes, exercises, formulas, course summaries, topic summaries, solved examples, external sources, and generated practice materials.

This separation is mandatory. Mixing them will cause retrieval errors and bad teaching behavior.

---

## 10. Learner memory policy

The tutor should save information related to Nevo and the tutor’s teaching behavior.

Policy:

```text
If confidence is high and the memory is relevant → save.
If confidence is medium/low → ask Nevo before saving.
At the beginning, ask more often.
Over time, as confidence improves, ask less often.
```

Important memories include repeated difficulties, explicit instructions from Nevo, explanation styles that worked, explanation styles that failed, topics already studied, repeated mistakes, user corrections, pacing preferences, and tutor behavior that Nevo disliked.

The tutor should also save what did not work, especially early in the project, because failed explanation patterns are useful for adaptation.

---

## 11. Memory lifecycle

The tutor must not delete or archive important memories automatically in the early stage.

Early policy:

```text
No automatic deletion of important memories.
No automatic archiving of meaningful memories.
If a new memory contradicts an old memory, ask Nevo.
```

Memory states:

```text
active
tentative
superseded
archived
deleted
```

Conflict rule:

```text
User correction beats model inference.
Explicit user instruction beats inferred preference.
Approved memory beats automatically inferred memory.
If uncertain, ask Nevo.
```

---

## 12. Memory visibility and control

Nevo must be able to inspect and edit memory.

MVP requirements:

- view what the tutor remembers about Nevo
- edit memory manually
- delete memory manually
- see important memory updates
- no export required in MVP

The memory UI should not dominate the main learning experience.

---

## 13. Incremental memory updates

The tutor must not wait for a conversation to “end” before saving memory.

There is no reliable “end of conversation” signal.

Instead, use rolling memory updates triggered by important events.

Triggers:

```text
new topic starts
file uploaded
Nevo corrects the tutor
repeated confusion detected
repeated behavior complaint detected
important preference stated
X messages passed since last summary
Y minutes of inactivity
Nevo explicitly says: save / summarize / finished
```

Memory types:

1. Working Memory — short-term state of the current session.
2. Rolling Session Summary — compact summary of the current segment.
3. Durable Learning Memory — long-term memory worth keeping.

---

## 14. User corrections

Nevo’s corrections are high-priority events.

Rules:

1. If Nevo corrects file/topic assignment, Nevo’s correction always wins.
2. If Nevo says “not what I meant,” save only if it repeats.
3. If Nevo says the tutor is rushing more than once in the same conversation, immediately update behavior rules.
4. Corrections should be stored as memory events when relevant.

Correction event schema:

```json
{
  "event_type": "user_correction",
  "priority": "high",
  "target": "teaching_behavior | file_assignment | topic_detection | explanation_style",
  "memory_update": true,
  "requires_instruction_update": true
}
```

---

## 15. Adaptive instructions

The tutor has two instruction layers:

### Core Instructions

Locked rules from Nevo’s existing tutor files.

These do not change without explicit approval.

### Adaptive Instructions

Learned behavior rules that adapt over time.

Policy:

```text
Small behavior updates may be applied automatically when confidence is high.
Large/general behavior changes require Nevo’s approval.
```

To avoid over-adaptation:

```text
One event does not create a permanent rule unless Nevo explicitly states it.
Permanent rules require explicit instruction, repeated evidence, or approval.
```

Adaptive instructions must be versioned.

---

## 16. Retrieval architecture

The MVP should start with Gemini File Search for retrieval over user files.

However, the app must use a retrieval abstraction layer so the system can later add or replace providers such as Supabase Vector, Pinecone, Weaviate, Redis, or another hybrid retrieval engine.

Required abstraction:

```ts
interface RetrievalProvider {
  search(query, scope, budget): Promise<RetrievedContext[]>;
  indexFile(file, metadata): Promise<IndexResult>;
  deleteFile(fileId): Promise<void>;
  updateMetadata(fileId, metadata): Promise<void>;
}
```

---

## 17. Retrieval governance

The tutor must not search the whole knowledge base for every question.

Before retrieval, the system must route the query.

Flow:

```text
User message
→ intent detection
→ retrieval decision
→ scope selection
→ budget selection
→ retrieval
→ rerank/compress if needed
→ tutor response
→ memory event detection
```

The system should support no retrieval, current session retrieval, topic retrieval, workspace retrieval, global concept retrieval, and web search.

Simple known academic facts should be answered without retrieval if the tutor is confident.

Broad questions should be decomposed with Nevo before expensive retrieval.

---

## 18. Retrieval budget

The system must enforce retrieval budgets.

### Cheap Practice Mode

No web search by default, minimal retrieval, prefer summaries, use cheaper model if available, avoid raw PDF chunks unless needed.

### Normal Learning Mode

Workspace-scoped retrieval, summaries first, limited chunks, web search only when justified.

### Deep Research Mode

Larger retrieval budget, web search allowed, raw chunks allowed, more citations, stronger model if configured.

---

## 19. Retrieval strategy

The preferred retrieval strategy is:

\[
\text{metadata filter}
\rightarrow
\text{semantic / hybrid search}
\rightarrow
\text{rerank}
\rightarrow
\text{context compression}
\]

In the MVP, Gemini File Search may handle much of this internally.

Still, every file and retrieved chunk should be associated with metadata.

When too much relevant content is found:

```text
rank
remove duplicates
prefer summaries
compress evidence
send only compact context
```

---

## 20. Summaries

The system should automatically create hierarchical summaries.

Required summary levels:

```text
file summary
topic summary
workspace/course summary
semester summary
learner progress summary
```

Default behavior:

```text
Search summaries first.
Search raw file chunks only if summaries are insufficient.
```

Stable summaries may be cached.

---

## 21. Concept Library

The system should support concepts that appear across multiple courses.

Example:

```text
Complex numbers
Derivative
Integral
Differential equation
Vector field
Fourier
Laplace
```

If the tutor needs knowledge from another course, it should not silently search the entire other workspace.

Default policy:

```text
Stay inside active workspace.
If a prerequisite from another workspace is needed, ask before cross-workspace retrieval.
If the concept is global/basic, use Concept Library.
```

---

## 22. Unknown topic flow

If Nevo asks about a topic that is not in the active workspace or known course list:

```text
If it is academic → answer and store temporarily.
If it repeats → propose creating a permanent topic/workspace.
If unclear → ask Nevo.
```

Temporary location:

```text
Unplaced Academic Inbox
Temporary Practice Workspace
General Academic Workspace
```

The tutor must not create permanent courses from one-off questions unless Nevo asks.

---

## 23. Web search

MVP web search should use Google Search Grounding.

The system should be architected with a WebSearchProvider abstraction so Tavily or another provider can be added later.

Web search is allowed when internal knowledge is insufficient, information may be current/recent, source verification is needed, external explanation may help, or Nevo asks for research.

When the tutor uses web search, it should say so.

If external sources conflict with course material, the tutor must present the conflict and not silently choose.

---

## 24. Model provider architecture

The MVP is Gemini-first.

However, the system should be multi-provider ready.

The app should not hard-code all tutor logic directly to one model provider.

Recommended abstraction:

```ts
interface ModelProvider {
  generateTutorResponse(input): Promise<TutorResponse>;
  generateStructuredOutput(input, schema): Promise<object>;
  embedText?(text): Promise<number[]>;
}
```

MVP:

```text
Gemini-first.
Do not implement many providers on day one.
Prepare architecture for future providers.
```

---

## 25. Work modes

Required modes:

```text
Learning
Practice
Research
Build / Project
Temporary Chat
```

Learning is the default tutor mode. Practice is lower-cost. Research allows wider retrieval and web search. Build / Project is for implementation work. Temporary Chat does not automatically affect permanent knowledge or memory.

---

## 26. Tutor progression policy

The tutor must not move to the next topic unless:

```text
there is high confidence that Nevo understood
and the current topic has clearly closed
```

Default behavior:

```text
No automatic next topic.
No automatic practice question.
No automatic “let’s continue” after local explanation.
```

The tutor may ask a short diagnostic question only when needed to identify confusion.

---

## 27. Question handling policy

If Nevo’s request is clear, answer.

If a critical detail is missing, ask one short clarification question.

If the question is too broad and would require expensive retrieval, break it down with Nevo first.

If Nevo is confused globally, rebuild the foundation.

If confusion is local, repair only that point.

If Nevo asks a simple known academic fact and the tutor is confident, answer directly without retrieval.

---

## 28. Source and citation policy

The tutor should not overload normal teaching responses with source noise.

But it must maintain internal source traceability.

Display sources when answer uses PDF/course material and page reference is useful, Nevo asks for source, web search was used, there is uncertainty, there is a contradiction, or answer depends on a specific uploaded file.

When answering from a PDF, include page/source when relevant.

When using web search, say that web search was used.

---

## 29. Decision Log

The system must maintain a hidden technical Decision Log.

Language: technical English.

The Decision Log is not shown on the main screen.

Log decisions for retrieval scope, web search use, memory write, memory not written, file assignment, file indexing, topic classification, clarification question, model/provider selection, and cost mode selection.

---

## 30. Failure handling

When a tool fails:

```text
Try once to repair.
If possible, use fallback tool/provider.
If still failing, explain exactly what failed and what Nevo can do.
```

The tutor must not pretend a failed tool succeeded.

---

## 31. Structured output

The tutor backend should request structured output from the model.

Visible response and internal state must be separated.

The app should validate structured output.

If invalid:

```text
retry once with repair prompt
then fallback safely
```

---

## 32. Backend / Genkit flows

Recommended AI backend architecture:

```text
Firebase / Firestore / Storage
Genkit flows
Gemini API
Gemini File Search
Google Search Grounding
Future provider abstractions
```

Suggested flows:

```text
handleTutorMessageFlow
classifyUploadedFileFlow
indexFileFlow
retrieveContextFlow
updateLearnerMemoryFlow
proposeAdaptiveInstructionFlow
generateSummariesFlow
webSearchFlow
runBehaviorTestFlow
```

The backend should own secrets, API keys, model calls, retrieval decisions, memory writes, file indexing, validation, and logging.

The frontend should not expose API keys.

---

## 33. Behavior regression tests

The system must include behavior tests.

Required tests:

```text
User says “רק כיוון” → tutor does not solve.
User asks “למה?” → tutor answers locally and stops.
User uploads unclear file → tutor asks, does not guess.
User asks broad question → tutor decomposes before broad retrieval.
User asks simple fact → no retrieval if confident.
User sends context-only file → tutor does not start solving.
User corrects assignment → correction wins.
Tutor is told twice it rushed → behavior rule updates.
Web search used → tutor says it used web search.
PDF answer used → source/page shown when relevant.
```

---

## 34. MVP scope

The MVP must prove:

1. Tutor follows Nevo’s core instruction files.
2. Tutor does not rush forward.
3. Tutor supports user-managed workspaces.
4. Tutor stores and retrieves learner memory separately from academic knowledge.
5. Tutor handles PDF/DOCX upload and indexing.
6. Tutor creates summaries.
7. Tutor performs workspace-scoped retrieval.
8. Tutor uses web search only when justified.
9. Tutor supports cost modes.
10. Tutor has behavior regression tests.
11. Tutor has a hidden technical Decision Log.

Out of MVP:

```text
native mobile app
voice/live tutor
screen sharing
complex analytics
gamification
OCR-heavy workflows
many model providers implemented at once
full GraphRAG
```

---

## 35. Definition of Done — MVP

The MVP is successful if these scenarios work:

1. New topic learning follows the tutor instruction structure.
2. Guidance only does not reveal solution.
3. Local conceptual question is answered and stopped.
4. PDF/DOCX upload is classified, indexed, summarized, and attached to workspace/topic.
5. Simple question uses no retrieval if confident.
6. Broad question is decomposed before broad retrieval.
7. Workspace moves preserve identity and linked data.
8. User correction wins.
9. Cheap Practice Mode reduces retrieval and avoids web by default.

---

## 36. Documents created from this PRD

1. Stitch UI Prompt & Design Requirements
2. Google AI Studio Build Prompt
3. Firebase / Genkit Backend Architecture
4. Gemini API Integration Spec
5. Retrieval & Memory Technical Spec
6. Jules Task List
7. MVP Implementation Checklist
8. Behavior Regression Test Suite
9. Project Folder Agent System Instructions

---

## 37. Current decisions summary

```text
Desktop-first responsive web app.
User-managed workspaces.
App-managed files.
Firebase + Firestore + Storage.
Genkit recommended for backend AI flows.
Gemini-first MVP.
Gemini File Search for MVP RAG.
Retrieval provider abstraction for future vector DB.
Google Search Grounding for MVP web search.
Tavily optional future provider.
Learner Memory separate from Academic Knowledge Base.
Incremental memory updates, not end-of-chat summaries.
Cost modes: Cheap Practice / Normal Learning / Deep Research.
Modes: Learning / Practice / Research / Build / Temporary Chat.
Hidden technical Decision Log in English.
Behavior regression tests required.
No native mobile app in MVP.
No OCR-heavy workflows in MVP.
```
