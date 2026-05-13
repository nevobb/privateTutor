# Domain Type Spec Alignment Report

## Branch

`chore/domain-type-spec-alignment` — branched from `main` at `d8866a8`

## Files changed

- `src/types/index.ts` — extended with spec-aligned types
- `src/mock/data.ts` — updated to satisfy new required Session fields and richer optional fields

## Files NOT changed

- `src/lib/tutor.ts` — deferred to PR 33B
- `src/server/tutor/*` — deferred to PR 33B
- `src/app/api/*` — not in scope
- `src/server/auth/*` — not in scope
- `src/server/workspaces/*` — not in scope
- `src/components/*` — not in scope
- `tests/*` — deferred to PR 33C
- All Firebase/Firestore/Storage config — not in scope

---

## Types added

### `TutorInternalUpdate`

Full spec-aligned structured internal update type for Gemini/model responses.
Shape from `docs/05_Gemini_API_Integration_Spec.md` and `docs/04_Firebase_Genkit_Backend_Architecture.md`.

Fields:
- `detected_intent: string`
- `confidence: number`
- `should_stop_progression: boolean`
- `local_question: { detected: boolean; reason: string }`
- `retrieval: { used: boolean; scope: RetrievalScope; source_ids: string[]; why: string }`
- `learner_memory_update: { needed: boolean; update_type; memory_type; content; confidence }`
- `knowledge_base_action: { needed: boolean; action; confidence; requires_user_confirmation }`
- `decision_log_entries: DecisionLogEntry[]`

Note: `TutorResponse.internalUpdates` (legacy flat array) is NOT yet replaced. PR 33B will wire `TutorInternalUpdate` into `TutorResponse` and the mock provider.

### New union types

- `MemoryObservationType` — `"preference" | "difficulty" | "correction" | "explanation_pattern" | "pacing" | "behavior_rule"`
- `MemoryScope` — `"global" | "workspace" | "topic" | "session"`
- `WorkspaceType` — `"course" | "temporary" | "general" | "archive" | "project"`
- `WorkspaceLifecycleStatus` — `"active" | "inactive" | "archived" | "deleted"` (wide union covering both `WorkspaceRecord.status` values and spec values)
- `SessionLifecycleStatus` — `"active" | "inactive" | "archived"`
- `FilePolicy` — `"knowledge_base_source" | "context_for_practice_generation" | "temporary_reference"`

---

## Types extended

### `MemoryObservationState`

Added: `"tentative" | "superseded" | "deleted"` alongside existing `"candidate" | "active" | "archived"`.
Backwards compatible — `tutor.ts` uses `"candidate"` which remains valid.

### `MemoryObservationSource`

Added: `"user_explicit" | "model_inferred" | "repeated_pattern"` alongside existing legacy values.
Backwards compatible — `tutor.ts` uses `"conversation"` which remains valid.

### `LearnerMemoryObservation`

Added optional fields: `type?`, `scope?`, `content?`, `workspaceId?`, `topic?`, `requiresApproval?`.
Kept: `observation`, `timestamp`, `confidence`, `state`, `source`, `appliesToWorkMode`.
All new fields are optional — `tutor.ts` and `schemas.ts` validator are not broken.

### `Workspace`

Added optional fields: `type?`, `status?`, `currentPath?`, `previousPaths?`, `courseContext?`, `createdAt?`, `updatedAt?`.
Kept: `id`, `name`, `description`, `path?`, `parentWorkspaceId?`, `stableIdentityNote?`.
`status` is optional and uses `WorkspaceLifecycleStatus` (wide union) to stay compatible with `WorkspaceRecord.status: "active" | "archived" | "deleted"` in `src/server/workspaces/workspaceTypes.ts`.

### `UploadedFile`

Added optional fields: `filePolicy?`, `topic?`, `subtopic?`, `summaryId?`, `indexProvider?`, `indexId?`, `confidence?`, `storagePath?`, `createdAt?`, `updatedAt?`.
Kept all existing fields.

### `Session`

Added required fields: `workMode`, `costMode`, `startedAt`, `lastActiveAt`, `status`.
Added optional field: `activeTopic?`.
Kept: `id`, `userId`, `workspaceId`, `messages`, `summary?`.
`mockSession` updated to satisfy new required fields.

### `AdaptiveInstruction`

Added optional fields: `scope?`, `workspaceId?`, `topic?`, `status?`, `updatedAt?`.
All existing fields kept unchanged.

---

## Mock data updated

### `mockWorkspace`

Added: `type: "course"`, `status: "active"`, `currentPath`, `previousPaths: []`, `courseContext`, `createdAt`, `updatedAt`.

### `mockFiles[0]` and `mockFiles[1]`

Added: `filePolicy: "knowledge_base_source"`, `topic`, `subtopic`, `confidence`, `createdAt`, `updatedAt`.

### `mockLearnerMemory.observations`

Extended obs-1: `type: "difficulty"`, `scope: "workspace"`, `workspaceId`, `topic`, `source: "repeated_pattern"`, `requiresApproval: false`.
Added obs-2: preference observation with `type: "preference"`, `scope: "global"`, `source: "user_explicit"`, `requiresApproval: false`.

### `mockSession`

Added required: `workMode: "Learning"`, `costMode: "Normal Learning"`, `startedAt`, `lastActiveAt`, `status: "active"`.
Added optional: `activeTopic: "Hebrew Narrative Fiction"`.

---

## Gaps addressed

| Gap | Status |
|-----|--------|
| GAP-001 TutorInternalUpdate missing | Type added. Mock wiring deferred to PR 33B. |
| GAP-002 LearnerMemory incomplete | LearnerMemoryObservation extended with type/scope/requiresApproval. Source/state extended. |
| GAP-007 Workspace missing lifecycle fields | status, type, currentPath, previousPaths, courseContext added. |
| GAP-008 UploadedFile missing classification/indexing | filePolicy, topic, subtopic, indexProvider, indexId, confidence, summaryId, storagePath added. |
| GAP-010 Session missing mode/topic/status | workMode, costMode, activeTopic, startedAt, lastActiveAt, status added. |

## Gaps intentionally deferred

| Gap | Reason |
|-----|--------|
| GAP-003 AdaptiveInstruction | Already existed — no action needed. |
| GAP-004 ProviderSettings | Intentionally minimal per AGENTS.md: "no multi-provider complexity in MVP beyond placeholders." |
| GAP-005 /api/tutor/respond | Accepted divergence — /api/tutor is the canonical endpoint. Decision Log entry planned. |
| GAP-006 Behavior tests string-based | Deferred to PR 33C — depends on PR 33B shape changes. |
| GAP-009 getMockTutorResponse lacks memory/history | Deferred to PR 33B — requires tutor.ts and schema changes. |

---

## Commands run

```
npm run build    → EXIT 0 (clean, no type errors)
npm run lint     → EXIT 0 (0 errors, 5 pre-existing warnings)
npx vitest run   → 110 passed, 87 skipped
git diff --check → CLEAN
```

---

## Scope constraints respected

- No route changes
- No behavior changes
- No test changes
- No Firebase/Auth/UI changes
- No package changes
- No API key or secret introduction

---

## Exact next recommended task

**PR 33B — Structured mock tutor response**

Files to change:
- `src/lib/tutor.ts` — update `getMockTutorResponse` to return `TutorInternalUpdate` instead of flat `internalUpdates`; add optional `conversationHistory` parameter stub
- `src/types/index.ts` — update `TutorResponse` to use `internalUpdate: TutorInternalUpdate`; remove legacy `internalUpdates` and `mockRouting`
- `src/server/tutor/schemas.ts` — update `validateTutorResponse` for new shape
- `src/server/tutor/mockTutorProvider.ts` — map new internal update shape
- `tests/server/tutor.handler.test.ts` — update for new shape

Do NOT touch behavior tests yet (PR 33C).
