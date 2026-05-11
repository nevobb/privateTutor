# Firebase / Genkit Backend Architecture

## מטרת המסמך

מסמך זה מגדיר את שכבת ה־backend של המורה.

ה־backend הוא החלק הקריטי שמונע מהמוצר להפוך לצ׳אטבוט פשוט. הוא אחראי על:

- שמירת קבצים
- זיכרון אישי
- בסיס ידע אקדמי
- retrieval routing
- cost control
- קריאות למודלים
- structured output validation
- decision logging
- behavior tests

---

## Recommended stack

```text
Frontend: React / TypeScript
Backend: Node / TypeScript
Auth: Firebase Authentication
Database: Firestore
File storage: Firebase Storage or equivalent app-managed storage
AI workflow layer: Genkit
Primary model provider: Gemini API
File retrieval: Gemini File Search in MVP
Web search: Google Search Grounding in MVP
Future search: Tavily via WebSearchProvider abstraction
```

---

## Why Genkit

Genkit should be used as the AI workflow layer because it is designed around flows, actions, prompts, type-safe schemas, local testing, observability, and deployment.

In this project, Genkit flows should wrap every important AI operation instead of scattering model calls throughout the codebase.

---

## Core backend principles

1. The frontend never calls model APIs directly.
2. API keys and secrets stay server-side.
3. Every model call should have a typed input and typed output.
4. Every important decision should be logged.
5. Every memory write should be intentional.
6. Retrieval must be routed and budgeted.
7. File ingestion must be asynchronous/status-based.
8. Structured output must be validated.
9. Failed model/tool calls must not be silently ignored.

---

## Data collections

### users/{userId}

```json
{
  "displayName": "Nevo",
  "createdAt": "timestamp",
  "defaultLanguage": "he",
  "activeWorkspaceId": "workspace_id",
  "settings": {
    "defaultWorkMode": "Learning",
    "defaultCostMode": "NormalLearning"
  }
}
```

### users/{userId}/workspaces/{workspaceId}

```json
{
  "workspaceId": "physics_2_2026",
  "displayName": "פיזיקה 2",
  "currentPath": "שנה א / סמסטר ב / פיזיקה 2",
  "previousPaths": ["פיזיקה 2"],
  "status": "active",
  "type": "course | temporary | general | archive | project",
  "courseContext": {
    "year": 1,
    "semester": 2,
    "course": "Physics 2"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### users/{userId}/files/{fileId}

```json
{
  "fileId": "file_123",
  "workspaceId": "physics_2_2026",
  "fileName": "lecture_04.pdf",
  "fileType": "pdf",
  "storagePath": "users/nevo/files/file_123.pdf",
  "status": "uploaded | extracting | indexed | failed",
  "assignmentStatus": "confirmed | tentative | unassigned | duplicate",
  "filePolicy": "knowledge_base_source | context_for_practice_generation | temporary_reference",
  "topic": "Gauss Law",
  "subtopic": "Electric Flux",
  "summaryId": "summary_123",
  "indexProvider": "gemini_file_search",
  "indexId": "provider_specific_id",
  "confidence": 0.91,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### users/{userId}/learnerMemory/{memoryId}

```json
{
  "memoryId": "mem_123",
  "type": "preference | difficulty | correction | explanation_pattern | pacing | behavior_rule",
  "content": "Nevo prefers local conceptual answers to stop cleanly.",
  "scope": "global | workspace | topic | session",
  "workspaceId": "physics_2_2026",
  "topic": "Gauss Law",
  "confidence": 0.91,
  "status": "active | tentative | superseded | archived",
  "source": "user_explicit | model_inferred | repeated_pattern",
  "requiresApproval": false,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### users/{userId}/knowledgeItems/{itemId}

```json
{
  "itemId": "knowledge_123",
  "workspaceId": "physics_2_2026",
  "type": "file_summary | topic_summary | course_summary | formula | concept | generated_practice_style",
  "title": "Gauss Law summary",
  "content": "...",
  "sourceFileIds": ["file_123"],
  "topic": "Gauss Law",
  "status": "active",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### users/{userId}/sessions/{sessionId}

```json
{
  "sessionId": "session_123",
  "workspaceId": "physics_2_2026",
  "workMode": "Learning",
  "costMode": "NormalLearning",
  "activeTopic": "Gauss Law",
  "startedAt": "timestamp",
  "lastActiveAt": "timestamp",
  "status": "active | inactive | archived"
}
```

### users/{userId}/decisionLogs/{logId}

```json
{
  "logId": "log_123",
  "decision_type": "retrieval_scope",
  "reason": "User is inside Physics 2 workspace",
  "workspaceId": "physics_2_2026",
  "payload": {},
  "timestamp": "timestamp"
}
```

---

## Required Genkit flows

### 1. handleTutorMessageFlow

Input:

```ts
{
  userId: string;
  sessionId: string;
  workspaceId: string;
  userMessage: string;
  workMode: WorkMode;
  costMode: CostMode;
}
```

Steps:

```text
Load user profile.
Load active workspace.
Load session state.
Detect intent.
Route retrieval.
Retrieve context if needed.
Call model provider.
Validate structured output.
Write decision logs.
Write memory events if needed.
Return visible response.
```

Output:

```ts
{
  visibleResponse: string;
  internalUpdate: TutorInternalUpdate;
}
```

---

### 2. classifyUploadedFileFlow

Input:

```ts
{
  userId: string;
  workspaceId: string;
  fileId: string;
}
```

Steps:

```text
Read file metadata.
Extract text preview.
Classify course/topic/policy.
Detect duplicate candidates.
Return confidence.
Ask user if uncertain.
```

---

### 3. indexFileFlow

Input:

```ts
{
  userId: string;
  fileId: string;
  workspaceId: string;
  metadata: FileMetadata;
}
```

Steps:

```text
Upload/index into RetrievalProvider.
Attach workspace metadata.
Attach topic metadata.
Update indexing status.
Log success/failure.
```

---

### 4. retrieveContextFlow

Input:

```ts
{
  userId: string;
  workspaceId: string;
  query: string;
  retrievalScope: RetrievalScope;
  costMode: CostMode;
}
```

Steps:

```text
Apply retrieval budget.
Prefer summaries.
Search active workspace first.
Do not search globally unless router allows.
Return compact retrieved context.
```

---

### 5. updateLearnerMemoryFlow

Input:

```ts
{
  userId: string;
  memoryCandidate: MemoryCandidate;
}
```

Rules:

```text
High confidence + small update → save.
Medium/low confidence → ask Nevo.
Contradiction → ask Nevo.
Important deletion/archive → ask Nevo.
```

---

### 6. proposeAdaptiveInstructionFlow

Used when the tutor detects a possible behavior rule update.

Example:

```text
Nevo corrected the tutor twice in one session for rushing.
```

Output:

```json
{
  "proposal": "When Nevo asks a local question, stop after answering and do not suggest continuation.",
  "requiresApproval": false,
  "reason": "Repeated correction in same session",
  "risk": "May stop too early in some contexts"
}
```

---

### 7. generateSummariesFlow

Creates:

```text
file summary
topic summary
workspace/course summary
semester summary
learner progress summary
```

Trigger:

```text
After file indexing.
After important session segment.
After topic completion.
Manual request.
Scheduled maintenance.
```

---

### 8. webSearchFlow

MVP provider:

```text
Google Search Grounding
```

Future provider:

```text
Tavily
```

Rules:

```text
Use web search only when justified.
Say when web search was used.
Log the decision.
If sources conflict, present conflict.
```

---

### 9. runBehaviorTestFlow

Runs regression tests against tutor behavior.

Input:

```ts
{
  testId?: string;
  runAll?: boolean;
}
```

Output:

```ts
{
  passed: boolean;
  results: BehaviorTestResult[];
}
```

---

## Provider abstractions

### ModelProvider

```ts
interface ModelProvider {
  generateTutorResponse(input: TutorModelInput): Promise<TutorModelOutput>;
  generateStructuredOutput<T>(input: StructuredInput, schema: Schema): Promise<T>;
  embedText?(text: string): Promise<number[]>;
}
```

### RetrievalProvider

```ts
interface RetrievalProvider {
  search(query: string, scope: RetrievalScope, budget: RetrievalBudget): Promise<RetrievedContext[]>;
  indexFile(file: UploadedFile, metadata: FileMetadata): Promise<IndexResult>;
  deleteFile(fileId: string): Promise<void>;
  updateMetadata(fileId: string, metadata: FileMetadata): Promise<void>;
}
```

### WebSearchProvider

```ts
interface WebSearchProvider {
  search(query: string, options: WebSearchOptions): Promise<WebSearchResult[]>;
  extract?(url: string): Promise<ExtractedContent>;
}
```

---

## Failure handling

Each flow must handle failure explicitly.

Standard policy:

```text
Try once to repair.
Use fallback if available.
If still failing, return clear failure reason.
Do not pretend success.
Log failure.
```

Example:

```json
{
  "decision_type": "tool_failure",
  "tool": "retrieveContextFlow",
  "reason": "Retrieval provider returned no relevant chunks",
  "fallback": "session_context_only",
  "timestamp": "..."
}
```

---

## Security rules

MVP must enforce:

```text
User can only access own data.
Files are scoped by userId.
Workspaces are scoped by userId.
API keys are server-side only.
Decision logs are private.
Memory is private.
```

Do not store API keys in frontend code or public repo.

---

## Backend acceptance checklist

Backend is acceptable if:

```text
There is a server-side tutor response route.
Model calls are not in frontend.
Structured output is validated.
Workspace-scoped retrieval exists.
Learner Memory and Academic Knowledge are separate.
File indexing has statuses.
Decision Log is written.
Behavior tests can run.
Cost modes affect retrieval/model behavior.
Failures are logged and visible in advanced debug.
```
