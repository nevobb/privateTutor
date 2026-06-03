# C5D Active Context Wording Report

## 1. Brain/state files read

- `AGENTS.md`
- `AGENT_TASK_PROTOCOL.md`
- `agent-memory/PROJECT_STATE_CURRENT.md`
- `agent-memory/PROJECT_BRAIN/00_CURRENT_STATE.md`
- `agent-memory/PROJECT_BRAIN/01_SYSTEM_PIPELINE_CONTRACTS.md`
- `agent-memory/PROJECT_BRAIN/02_CHANGE_IMPACT_MATRIX.md`
- `agent-memory/PROJECT_BRAIN/03_RISK_REGISTER.md`
- `agent-memory/C5B_C5C_CONTEXT_PICKER_CONSOLIDATION_REPORT.md`
- repo continuity files also re-read because `AGENTS.md` requires them:
  - `agent-memory/PROJECT_STATE.md`
  - `agent-memory/CURRENT_TASK.md`
  - `agent-memory/DUAL_AGENT_SYNC_LOG.md`

## 2. Graphify queries run

- `selected context files attachedFileIds tutor prompt`
- `TutorConversation context chips selected files`
- `sessionMessageApiService active attached files whole course fallback`
- `file inventory active context attached files`
- `no whole course search by default`

## 3. Impact prediction

- Safe change surface:
  - `src/server/tutor/requestClassifier.ts`
  - `src/server/workspaces/sessionMessageApiService.ts`
  - minimal composer wording in `src/components/tutor/TutorConversation.tsx`
- Main regression risks:
  - accidentally implying whole-course search when only selected files were considered
  - weakening the selected-file persistence model from C5B/C5C
  - breaking existing C4 readiness and attachment prioritization behavior
  - drifting into retrieval/backend changes outside wording and deterministic routing

## 4. Behavior before

- Selected file chips existed and persisted correctly.
- Grounding policy already restricted selected-file answers, but the wording was still internal and did not name the active files.
- Questions like `איזה חומר פעיל בשיחה?` were not deterministic; they fell through to the generic tutor path.
- Vague file-specific questions with no selected context (for example `תפתור את שאלה 3`) could still fall into the generic tutor path instead of asking which course material to use.
- When selected-file retrieval returned zero chunks, the provider path could still proceed in a way that did not clearly say “not enough in the selected file.”

## 5. Behavior after

- Active-context status questions are now deterministic.
  - Examples:
    - `איזה חומר פעיל בשיחה?`
    - `איזה קובץ בחרתי?`
    - `על איזה קובץ אנחנו עובדים?`
- Those questions now answer from the selected attached file names, never raw IDs.
- The grounding instruction now explicitly says:
  - the user selected these files as active conversation context
  - the tutor must not imply it searched the rest of the course
- With no active selected context, vague file-specific asks now get a clarification response instead of a silent course-wide search.
- If selected-file retrieval returns no chunks, the assistant now responds honestly that it did not find enough in the selected file(s) and asks whether to search the rest of the course.
- The chip area in the composer now clearly reads as course context with:
  - `חומר פעיל בשיחה`

## 6. Exact no-whole-course-search rule

- If `attachedFileIds` are active:
  - answer from those selected files only
  - do not imply the rest of the course was searched
  - if not enough is found, ask:
    - `האם תרצה שאחפש בשאר חומרי הקורס?`
- If no active selected file exists and the user asks a vague file-specific question like:
  - `תפתור את שאלה 3`
  - `תסביר את זה`
  - `מה כתוב בקובץ?`
  the assistant must ask which file/material to use instead of silently searching all course files.
- Whole-course search is allowed only when the user explicitly asks for it.

## 7. Files changed

- `src/server/tutor/requestClassifier.ts`
- `src/server/workspaces/sessionMessageApiService.ts`
- `src/components/tutor/TutorConversation.tsx`
- `tests/server/tutor/requestClassifier.test.ts`
- `tests/server/workspaces/sessionMessageApiService.test.ts`
- `tests/server/tutor/deepseekProviderGrounding.test.ts`
- `tests/components/tutor/TutorConversation.test.tsx`
- `agent-memory/C5D_ACTIVE_CONTEXT_WORDING_REPORT.md`

## 8. Tests added/updated

- Added request-classifier tests for active-context status questions.
- Added service tests for:
  - active selected-file naming
  - no silent whole-course search on vague file-specific questions with no active context
  - selected-file names included in grounding instruction
  - honest empty-selected-file fallback
- Updated grounding test to reflect active-conversation-context wording.
- Updated composer static render test to expect `חומר פעיל בשיחה`.
- Updated older service expectations that conflicted with the new no-whole-course-by-default rule.

## 9. Validation results

- `npx tsc --noEmit` ✅
- `npx vitest run tests/server/tutor/requestClassifier.test.ts tests/components/tutor/TutorConversation.test.tsx tests/server/tutor/deepseekProviderGrounding.test.ts tests/server/workspaces/sessionMessageApiService.test.ts` ✅
- `npx vitest run` ✅
- `npm run build` ✅
- `git diff --check` ✅
- `graphify update .` ✅

## 10. Manual smoke checklist

1. Select one ready file with `בחר חומר מהקורס`.
2. Ask `איזה חומר פעיל בשיחה?`
3. Confirm the tutor names the selected file.
4. Ask a follow-up about the file.
5. Confirm it still uses the selected file.
6. Open a no-selected-context case.
7. Ask `תפתור את שאלה 3`.
8. Confirm it asks which file/material to use instead of silently searching the whole course.
9. Select two files.
10. Ask which files are active.
11. Confirm both file names are shown.

## 11. Risks / open decisions

- There are still pre-existing dirty tracked files in tutor/retrieval areas outside the exact files listed above; this batch did not attempt to normalize the whole working tree.
- The rule for explicit whole-course search is phrase-based today. If product later wants broader natural-language coverage, that should be a separate classifier improvement batch.
- The clear-context affordance still exists as the small `נקה קונטקסט` control; no broader “context management” UX was added here.

## 12. Ready for Nevo manual smoke

YES

## 13. Safety confirmations

- Deep PDF was not changed.
- Extraction/chunking were not changed.
- Upload processing was not changed.
- Soft delete semantics were not changed.
- Learner memory was not implemented.

## 14. Git confirmations

- No `git pull` was run.
- No `git add` was run.
- No `git commit` was run.
- No `git push` was run.
