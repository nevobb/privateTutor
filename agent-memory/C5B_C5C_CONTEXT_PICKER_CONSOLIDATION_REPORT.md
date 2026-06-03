# C5B/C5C Context Picker Consolidation Report

## 1. Brain files read

- `AGENTS.md`
- `agent-memory/PROJECT_BRAIN/00_CURRENT_STATE.md`
- `agent-memory/PROJECT_BRAIN/01_SYSTEM_PIPELINE_CONTRACTS.md`
- `agent-memory/PROJECT_BRAIN/02_CHANGE_IMPACT_MATRIX.md`
- `agent-memory/PROJECT_BRAIN/03_RISK_REGISTER.md`
- `agent-memory/PROJECT_BRAIN/04_AGENT_PREFLIGHT_PROTOCOL.md`
- `agent-memory/PROJECT_BRAIN/05_REGRESSION_SMOKE_PLAYBOOK.md`
- `agent-memory/COURSE_KNOWLEDGE_CONTEXT_PICKER_FIT_CHECK.md`
- `agent-memory/CONTINUATION_READINESS_CHECK_C5B_C5C.md`
- fallback source used for normalization: `agent-memory/privateTutor_current_state_2026-06-03_v0.2.md`

## 2. Graphify queries run

- `FilePanel onUseInChat ready file selected context`
- `page.tsx stagedContextFiles TutorConversation FilePanel`
- `TutorConversation attachedFileIds selected context chips`
- `plus menu upload file old upload-on-send path`
- `sessionMessageApiService test mock property failure`
- `C5B C5C course knowledge context picker`

## 3. Impact prediction

- The already-partial C5B/C5C flow spans `FilePanel -> page.tsx -> TutorConversation -> sendSessionMessage`.
- The highest-risk regression points were:
  - breaking Study Materials upload while relabeling composer upload
  - clearing selected course context after send, which would violate the new product rule
  - weakening the ready-file gate and accidentally letting processing files become selectable
  - “fixing” the TypeScript failure with a broad cast that hides real mock misuse
- Safety checks needed:
  - `npx tsc --noEmit`
  - focused UI/static tests around `FilePanel` and `TutorConversation`
  - existing C1/C4 service tests
  - full `vitest` / `build` / `graphify update`

## 4. Working tree state before repair

- Branch: `repair/workspace-cleanup-fit-check`
- HEAD: `50ca961 feat: implement C4 attached-file prioritization and readiness gating`
- The working tree was already dirty before this repair. Relevant partial C5B/C5C work already existed in tracked files:
  - `src/app/page.tsx` already owned `stagedContextFiles`
  - `src/components/files/FilePanel.tsx` already had ready-only `onUseInChat`
  - `src/components/tutor/TutorConversation.tsx` already sent `attachedFileIds` from selected context files
- The tree was not type-clean because `tests/server/workspaces/sessionMessageApiService.test.ts` accessed a Vitest mock with incorrect typing.

## 5. Root cause of TypeScript failure

- Exact failure:
  - `tests/server/workspaces/sessionMessageApiService.test.ts(2530,48): Property 'mock' does not exist ...`
- Root cause:
  - `repos.getMockTutorResponse` is a mocked function, but that specific test used direct `.mock.calls` access without the Vitest mock cast already used elsewhere in the same file.
- This was a test typing bug, not a runtime/service bug.

## 6. Fix made for TypeScript failure

- Updated the failing test to use:

```ts
(repos.getMockTutorResponse as ReturnType<typeof vi.fn>).mock.calls
```

- This matches the existing convention already used elsewhere in the same test file and keeps the fix narrow.

## 7. Current C5B/C5C implementation state

- `page.tsx` owns the selected course-context state.
- `FilePanel` exposes a ready-only action for course files.
- `TutorConversation` renders selected context chips and sends `attachedFileIds`.
- The old upload-on-send behavior is no longer the active chat-context model.
- This repair completed the consolidation needed for product coherence:
  - selected context is no longer cleared after a successful send
  - selected context is no longer cleared after timeout recovery
  - the upload affordance is labeled as course-material upload, not as immediate chat attachment

## 8. Selected course-file flow

```text
FilePanel ready file
→ onUseInChat(fileId, fileName)
→ page.tsx handleToggleFileContext(...)
→ stagedContextFiles state
→ TutorConversation renders chips
→ sendSessionMessage(... attachedFileIds)
```

- Chips carry uploaded-file IDs and names, not raw `File` objects.
- Sending with selected context does not upload anything during send.
- Existing C4 retrieval prioritization remains the backend consumer of `attachedFileIds`.

## 9. What happened to the old plus-menu upload-on-send path

- The plus-menu upload row remains available.
- Its role is now explicitly course-material upload:
  - label changed to `העלה חומר לקורס`
- It does **not** auto-attach newly uploaded files to the current message.
- The selected-context flow is now clearly the ready-file path, not the upload path.

## 10. Ready-file rule

- Only ready files are selectable as chat context.
- Readiness remains:
  - `extractionStatus === "completed"`
  - `chunkingStatus === "completed"`
  - `embeddingStatus === "completed"`
- Non-ready files do not show the `use-in-chat` button in `FilePanel`.

## 11. Files changed

- `src/components/tutor/TutorConversation.tsx`
- `src/components/files/FilePanel.tsx`
- `tests/components/tutor/TutorConversation.test.tsx`
- `tests/components/files/FilePanel.test.tsx`
- `tests/server/workspaces/sessionMessageApiService.test.ts`
- `agent-memory/PROJECT_STATE_CURRENT.md`
- `agent-memory/C5B_C5C_CONTEXT_PICKER_CONSOLIDATION_REPORT.md`

## 12. Tests added/updated

- Updated `TutorConversation` tests to reflect:
  - staged context files as `{ fileId, fileName }`
  - study-material upload label in the plus menu
- Updated `FilePanel` tests to assert the Hebrew-first course-context action label
- Repaired the typed mock access in `sessionMessageApiService` tests

## 13. Validation results

- `npx tsc --noEmit` ✅
- `npx vitest run tests/components/files/FilePanel.test.tsx tests/components/tutor/TutorConversation.test.tsx tests/server/workspaces/sessionMessageApiService.test.ts` ✅
- `npx vitest run` ✅
- `npm run build` ✅
- `git diff --check` ✅
- `graphify update .` ✅

## 14. Untracked file classification

- `agent-memory/PROJECT_STATE_CURRENT.md`
  - New canonical state file created in this batch
  - Should be committed later
- `agent-memory/privateTutor_current_state_2026-06-03_v0.2.md`
  - Source snapshot
  - Keep for traceability; do not delete casually
- `agent-memory/CONTINUATION_READINESS_CHECK_C5B_C5C.md`
  - Useful memory doc
  - Should be committed later
- `agent-memory/COURSE_KNOWLEDGE_CONTEXT_PICKER_IMPLEMENTATION_REPORT.md`
  - Likely useful memory doc
  - Should be reviewed and then committed later if still accurate
- `QA_GAP_REPORT.md`
  - Project-memory/report candidate
  - Should be reviewed before deciding whether to commit
- `tests/evaluation/`
  - Intentional evaluation assets if actively used
  - Should either be committed as an evaluation harness or explicitly ignored later
- `BaseTutorInstructionsFiles/`
  - Reference content/assets
  - Should be classified deliberately; do not silently ignore or delete

## 15. Manual smoke checklist

1. Upload a PDF to Study Materials.
2. Confirm it is not selectable until ready.
3. When ready, click `בחר חומר מהקורס`.
4. Confirm a chip appears in the composer.
5. Send a question about that file.
6. Confirm the tutor answers from the selected file.
7. Send a follow-up without selecting again.
8. Confirm the tutor still uses the selected file context.
9. Select a second ready file.
10. Confirm both context chips appear and both remain active until changed.
11. Confirm a normal message without selected context still works.
12. Confirm plus-menu upload does not imply immediate answerability.

## 16. Risks / open decisions

- There are still pre-existing dirty tracked files outside this repair (`src/lib/tutor.ts`, `src/server/tutor/deepseekGroundingPrompt.ts`, retrieval-related files and tests). This batch did not normalize those.
- The product now has two entry points for selecting course context:
  - `FilePanel` ready-file button
  - plus-menu file picker
  This is coherent enough for now, but it may be worth simplifying later.
- The clear-context control already exists in the composer; later UX polish may want a calmer presentation, but it is functionally useful now.

## 17. Ready for Nevo manual smoke

YES

## 18. Safety confirmations

- Deep PDF was not changed in this batch.
- Extraction/chunking were not changed in this batch.
- Retrieval backend was not changed in this batch.
- Soft delete semantics were not changed in this batch.
- Learner memory was not implemented in this batch.
- No `git add`, `git commit`, `git push`, or `git pull` were run.
