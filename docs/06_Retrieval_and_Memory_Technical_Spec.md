# Retrieval & Memory Technical Spec

## מטרת המסמך

מסמך זה מגדיר את לוגיקת הזיכרון והשליפה של המורה.

זו אחת השכבות הכי חשובות בפרויקט. אם היא בנויה לא נכון, המורה ישרוף תקציב, ישלוף חומר לא נכון, יזכור דברים ישנים מדי, ויהפוך לצ׳אטבוט מבולגן עם קבצים.

---

## Core principle

\[
\text{Retrieve less, but retrieve the right things}
\]

The system must never send the full knowledge base to the model.

---

## Memory layers

### 1. Core Profile

Small set of always-relevant global instructions.

Includes:

```text
Hebrew language
teaching tone
deep understanding before progress
no rushing
core locked tutor rules
```

### 2. Working Memory

Current session state.

```json
{
  "active_workspace_id": "physics_2_2026",
  "active_topic": "Gauss Law",
  "active_file_id": "file_123",
  "work_mode": "Learning",
  "cost_mode": "NormalLearning",
  "do_not_solve": true,
  "local_question_active": true
}
```

### 3. Episodic Memory

What happened in previous sessions.

Stores:

```text
session summaries
resolved topics
open threads
important corrections
learning trajectory
```

### 4. Semantic Academic Knowledge

Course material.

Stores:

```text
PDF/DOCX files
file summaries
topic summaries
course summaries
formula sheets
practice styles
source references
```

### 5. Procedural Memory

How to teach Nevo.

Stores:

```text
do not rush
answer local questions and stop
avoid automatic practice
slow down when confused
explain intuition before formula
```

### 6. Concept Library

Global reusable concepts across courses.

Examples:

```text
complex numbers
derivatives
integrals
vectors
Fourier
Laplace
```

---

## Retrieval router

Every user message goes through routing before retrieval.

Router output:

```json
{
  "needs_retrieval": true,
  "retrieval_scope": "workspace",
  "reason": "The question refers to active Physics 2 material.",
  "max_chunks": 4,
  "max_tokens": 4000,
  "use_summaries_first": true,
  "web_search_allowed": false,
  "should_ask_clarification_first": false
}
```

---

## Retrieval scopes

```text
none
session
topic
workspace
concept_library
global_learner_memory
web
```

### none

Use when question is simple and tutor is confident.

### session

Use current conversation and rolling summary only.

### topic

Use active topic memory and summaries.

### workspace

Use active workspace files and summaries.

### concept_library

Use global concept explanations without scanning other course workspaces.

### global_learner_memory

Use high-level learner preferences only.

### web

Use external search when justified.

---

## Retrieval budget by cost mode

### Cheap Practice Mode

```json
{
  "max_chunks": 2,
  "max_tokens": 2000,
  "allow_raw_file_chunks": false,
  "allow_web_search": false,
  "prefer_summaries": true
}
```

### Normal Learning Mode

```json
{
  "max_chunks": 4,
  "max_tokens": 5000,
  "allow_raw_file_chunks": true,
  "allow_web_search": "only_when_justified",
  "prefer_summaries": true
}
```

### Deep Research Mode

```json
{
  "max_chunks": 10,
  "max_tokens": 12000,
  "allow_raw_file_chunks": true,
  "allow_web_search": true,
  "prefer_summaries": false,
  "require_sources": true
}
```

---

## Retrieval pipeline

Preferred pipeline:

```text
1. Detect intent
2. Decide retrieval need
3. Select scope
4. Apply metadata filters
5. Retrieve summaries first
6. Retrieve raw chunks only if needed
7. Rerank / deduplicate
8. Compress evidence
9. Send compact context to model
10. Log decision
```

---

## Metadata-first retrieval

Every retrievable item must include metadata.

```json
{
  "workspace_id": "physics_2_2026",
  "year": 1,
  "semester": 2,
  "course": "Physics 2",
  "topic": "Gauss Law",
  "subtopic": "Electric Flux",
  "source_type": "lecture_pdf",
  "file_name": "lecture_04.pdf",
  "page": 12,
  "importance": "high",
  "confidence": 0.91,
  "status": "confirmed"
}
```

Search must start with metadata filtering whenever possible.

---

## Summaries-first strategy

Default retrieval order:

```text
1. Working memory
2. Rolling session summary
3. Topic summary
4. File summary
5. Raw file chunks
6. Course/workspace summary
7. Concept library
8. Web search
```

Raw chunks are expensive and noisy. They should be used only when summaries are insufficient.

---

## When not to retrieve

No retrieval when:

```text
question is simple and tutor is confident
answer depends only on current conversation
user asks for final answer only and answer is obvious
user asks for tone/behavior correction
message is administrative
```

Examples:

```text
מה הנגזרת של sin(x)?
רק תשובה סופית
אל תרוץ קדימה
```

---

## Broad query handling

If query is broad and retrieval would be expensive:

1. Do not search globally immediately.
2. Ask a narrowing question.
3. Search only the specific unclear part.

Example response:

```text
השאלה רחבה מדי כדי לחפש חכם בבסיס הידע. אתה מתכוון לזה בהקשר של פיזיקה 2, חדו״א, או משהו כללי?
```

---

## Unknown topic handling

If topic is not known:

```text
Answer if academic and possible.
Store temporarily in Inbox or Temporary Workspace.
If repeated, propose permanent topic/workspace.
Do not create permanent course from one-off question.
```

---

## Cross-workspace handling

Default:

```text
Stay inside active workspace.
```

If another course is needed:

```text
Ask before cross-workspace retrieval.
```

If concept is basic/global:

```text
Use Concept Library.
```

---

## Memory write policy

Memory write candidate:

```json
{
  "type": "preference",
  "content": "Nevo dislikes automatic practice questions after explanations.",
  "confidence": 0.94,
  "scope": "global",
  "requires_approval": false
}
```

Rules:

```text
High confidence + small update → save.
Medium/low confidence → ask Nevo.
Contradiction → ask Nevo.
Broad behavior change → ask Nevo unless repeated correction happened.
No deletion/archive without approval in early stage.
```

---

## Memory event classifier

Classify every meaningful interaction.

```json
{
  "should_store": true,
  "type": "preference | misconception | topic_progress | file_ingestion | instruction_change | none",
  "importance": "low | medium | high",
  "durability": "session_only | topic_memory | global_profile",
  "requires_approval": false
}
```

Do not store meaningless messages:

```text
כן
סבבה
תמשיך
רגע
```

Unless part of a larger event.

---

## Conflict resolution

Rules:

```text
User correction beats model inference.
Explicit instruction beats inferred preference.
Approved memory beats automatic memory.
Current active workspace beats guessed workspace.
Course material beats external source for course-specific work.
If uncertain, ask Nevo.
```

When conflict occurs:

```text
Do not silently overwrite.
Mark old memory as superseded only after confirmation or clear explicit correction.
```

---

## Memory statuses

```text
active
tentative
superseded
archived
deleted
```

Early project rule:

```text
No automatic deletion or archiving of meaningful memories.
```

---

## Deduplication

When new file or memory is similar to existing item:

```text
Detect duplicate candidate.
Ask Nevo in early stage.
Later save only if new information exists.
Link duplicate to original.
Do not index identical content repeatedly.
```

---

## Formula and notation handling

For academic chunks, preserve:

```text
formula text
LaTeX normalized version
symbol definitions
units
source page
topic/subtopic
```

The tutor must not present formulas without definitions.

---

## Decision logging

Every retrieval and memory decision should be logged in technical English.

Example:

```json
{
  "decision_type": "memory_write",
  "reason": "User explicitly stated a long-term teaching preference",
  "memory_type": "pacing",
  "confidence": 0.96,
  "requires_approval": false,
  "timestamp": "..."
}
```

---

## Retrieval test cases

### Simple fact

Input:

```text
מה הנגזרת של sin(x)?
```

Expected:

```text
No retrieval.
Direct answer.
```

### Active file question

Input:

```text
למה בשורה הזאת הם עברו ל-r<a?
```

Expected:

```text
Use active file/session context.
No global search.
```

### Broad question

Input:

```text
תסביר לי פיזיקה 2
```

Expected:

```text
Ask narrowing question.
No broad retrieval.
```

### Cross-workspace prerequisite

Input in Physics workspace:

```text
אני לא מבין את האינטגרל הזה
```

Expected:

```text
Use local prerequisite patch or ask before retrieving from Calculus workspace.
```

---

## Acceptance criteria

Retrieval and memory layer is acceptable if:

```text
Simple questions avoid retrieval.
Active workspace scopes retrieval.
Summaries are preferred.
Raw chunks are limited.
User corrections win.
Memory writes are intentional.
Conflicts ask Nevo.
Decision Log records retrieval/memory decisions.
Cost modes change retrieval behavior.
```
