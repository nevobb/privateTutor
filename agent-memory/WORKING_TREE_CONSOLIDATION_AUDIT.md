# Working Tree Consolidation Audit

**Date:** 2026-06-03
**Auditor:** Claude (diagnostic, read-only)
**Branch:** repair/workspace-cleanup-fit-check
**HEAD:** 9ee1a56 docs: add conversation file attachment fit check

---

## Branch / HEAD

```
repair/workspace-cleanup-fit-check
9ee1a56 docs: add conversation file attachment fit check
```

---

## Working tree summary

- 28 tracked files modified
- 14 untracked items (8 paths shown by git ls-files, but .tmp/ contains multiple files and 4 new src/tests files exist)
- `tsc --noEmit`: PASSED (exit 0)
- `git diff --check`: PASSED (no whitespace errors)
- `vitest run`: NOT RUN (rolldown binary missing in this environment; last known pass: 77 passed / 18 skipped)

---

## Dirty file classification

### Tracked modified files

| File | Status | Category | Commit group | Notes |
|---|---|---|---|---|
| `agent-memory/DUAL_AGENT_SYNC_LOG.md` | M | Project Brain | A — Project Brain | Sync log updates |
| `next.config.ts` | M | Settings repair | B — Settings repair | allowedDevOrigins fix for 127.0.0.1 hydration |
| `src/app/api/sessions/[sessionId]/messages/route.ts` | M | Conversation attachment C1 | C — C1 data model | Route updated to handle attachedFileIds |
| `src/app/globals.css` | M | UI/Stitch visual work | D — UI/Stitch | Visual design pass changes |
| `src/app/page.tsx` | M | Mixed: Settings repair + partial UI | B+D | Settings applyStoredDisplayPreferences on mount; upload path unchanged |
| `src/app/settings/page.tsx` | M | Settings repair | B — Settings repair | Uses settingsPreferences module, navigation fixed |
| `src/components/files/FilePanel.tsx` | M | UI/Stitch visual work | D — UI/Stitch | Visual pass |
| `src/components/layout/CollapsiblePanel.tsx` | M | UI/Stitch visual work | D — UI/Stitch | Visual pass |
| `src/components/layout/MainLayout.tsx` | M | UI/Stitch visual work | D — UI/Stitch | Visual pass |
| `src/components/settings/ThemePicker.tsx` | M | Settings repair + UI/Stitch | B+D | Part of settings repair and visual pass |
| `src/components/tutor/TutorConversation.tsx` | M | UI/Stitch visual work | D — UI/Stitch | Visual pass; sendSessionMessage does NOT yet pass attachedFileIds |
| `src/components/workspaces/WorkspaceSelector.tsx` | M | UI/Stitch visual work | D — UI/Stitch | Visual pass |
| `src/lib/sessions/sessionMessagesApiClient.ts` | M | Conversation attachment C1 | C — C1 data model | Line 51: passes attachedFileIds in request body |
| `src/lib/sessions/sessionMessagesApiTypes.ts` | M | Conversation attachment C1 | C — C1 data model | SendMessageInput has attachedFileIds?: string[] |
| `src/server/workspaces/messageRepository.ts` | M | Conversation attachment C1 | C — C1 data model | Lines 64, 113–114: persist + read back from Firestore |
| `src/server/workspaces/sessionMessageApiSchemas.ts` | M | Conversation attachment C1 | C — C1 data model | Full parse + validate (max 10, non-empty strings) |
| `src/server/workspaces/sessionMessageApiService.ts` | M | Conversation attachment C1 | C — C1 data model | Line 155: validateAttachedFileIds() called |
| `src/server/workspaces/workspaceTypes.ts` | M | Conversation attachment C1 | C — C1 data model | AppendMessageInput has attachedFileIds?: string[] |
| `src/types/index.ts` | M | Conversation attachment C1 | C — C1 data model | TutorMessage has attachedFileIds?: string[] (line 333) |
| `tests/components/pageDiagnosticsToggle.test.ts` | M | Settings repair | B — Settings repair | Diagnostics toggle test |
| `tests/components/tutor/TutorConversation.test.tsx` | M | Conversation attachment C1 | C — C1 data model | Test coverage for C1 changes |
| `tests/components/workspaces/WorkspaceSelector.test.tsx` | M | UI/Stitch visual work | D — UI/Stitch | Visual pass test |
| `tests/firebase/workspacePersistence.emulator.test.ts` | M | Unknown / needs review | — | Unclear scope; may cover C1 persistence or Settings |
| `tests/lib/sessions/sessionMessagesApiClient.test.ts` | M | Conversation attachment C1 | C — C1 data model | Client test for attachedFileIds pass-through |
| `tests/server/workspaces/messageRepository.test.ts` | M | Conversation attachment C1 | C — C1 data model | Repository persistence test |
| `tests/server/workspaces/sessionMessageApiRoute.test.ts` | M | Conversation attachment C1 | C — C1 data model | Route-level test |
| `tests/server/workspaces/sessionMessageApiSchemas.test.ts` | M | Conversation attachment C1 | C — C1 data model | Schema parse/validate test |
| `tests/server/workspaces/sessionMessageApiService.test.ts` | M | Conversation attachment C1 | C — C1 data model | Service-level test including validateAttachedFileIds |

### Untracked files

| File | Category | Commit group | Notes |
|---|---|---|---|
| `.tmp/stitch/...` (all) | UI/Stitch visual work | DO NOT COMMIT | Stitch-generated HTML+screenshots; gitignore candidate |
| `QA_GAP_REPORT.md` | QA/reports only | E — QA reports | External QA gap report (root-level) |
| `agent-memory/CONVERSATION_FILE_ATTACHMENT_C1_DATA_MODEL_REPORT.md` | Project Brain | A — Project Brain | C1 implementation report |
| `agent-memory/DIAGRAM_AWARE_DEEP_PDF_DIAGNOSTIC.md` | Project Brain | A — Project Brain | Diagram gap diagnostic |
| `agent-memory/EXTERNAL_QA_GAP_RECONCILIATION_REPORT.md` | QA/reports only | E — QA reports | External QA reconciliation (this file) |
| `agent-memory/SETTINGS_NAVIGATION_AND_PERSISTENCE_REPAIR_REPORT.md` | Settings repair | B — Settings repair | Settings repair report |
| `agent-memory/STITCH_DESIGN_GAP_ANALYSIS_AND_IMPLEMENTATION_PLAN.md` | UI/Stitch visual work | D — UI/Stitch | Stitch design plan |
| `agent-memory/UI_UX_POLISH_PRODUCT_FEEL_REPORT.md` | UI/Stitch visual work | D — UI/Stitch | UI polish report |
| `agent-memory/UI_VISUAL_ALIGNMENT_STITCH_PASS_REPORT.md` | UI/Stitch visual work | D — UI/Stitch | Visual alignment report |
| `agent-memory/UI_VISUAL_DESIGN_CODEX_PASS_REPORT.md` | UI/Stitch visual work | D — UI/Stitch | Visual design codex report |
| `src/components/ui/TutorUI.tsx` | UI/Stitch visual work | D — UI/Stitch | New UI component from Stitch pass |
| `src/lib/settings/settingsPreferences.ts` | Settings repair | B — Settings repair | New shared settings module |
| `tests/app/settingsNavigationAndPersistence.test.ts` | Settings repair | B — Settings repair | Settings integration test |
| `tests/app/settingsThemePlacement.test.tsx` | Settings repair | B — Settings repair | Theme placement test |

---

## Conversation attachment C1 status

**Implemented: PARTIAL**

### Evidence — DONE in working tree:

| Layer | File | Evidence |
|---|---|---|
| Type | `src/types/index.ts:333` | `attachedFileIds?: string[]` on `TutorMessage` |
| Type | `src/server/workspaces/workspaceTypes.ts:134` | `attachedFileIds?: string[]` on `AppendMessageInput` |
| Client type | `src/lib/sessions/sessionMessagesApiTypes.ts:9` | `attachedFileIds?: string[]` on `SendMessageInput` |
| Schema | `src/server/workspaces/sessionMessageApiSchemas.ts:13,25,67–79,124–153` | Full parse + validation: max 10 IDs, non-empty strings, array-only |
| Repository | `src/server/workspaces/messageRepository.ts:64,113–114` | Persists to Firestore; reads back with type guard |
| Service | `src/server/workspaces/sessionMessageApiService.ts:155` | `validateAttachedFileIds(userId, workspaceId, attachedFileIds)` called before append |
| API client | `src/lib/sessions/sessionMessagesApiClient.ts:51` | `attachedFileIds: input.attachedFileIds` sent in request body |
| Tests | Multiple test files | Schema, repository, service, route, client tests all present |

### Evidence — MISSING (not in working tree):

| Layer | File | Gap |
|---|---|---|
| Composer state | `src/components/tutor/TutorConversation.tsx` | No `stagedAttachedFileIds` state exists |
| Composer wire | `src/components/tutor/TutorConversation.tsx:219–225` | `sendSessionMessage(...)` call omits `attachedFileIds` entirely |
| Upload return | `src/app/page.tsx:351–399` | `handleFileSelected` returns `Promise<void>`; no file ID returned to composer for staging |
| Retrieval | `src/server/workspaces/fileChunkRetrievalService.ts` | No `attachedFileIds` input, no prioritization logic (file NOT in git diff) |

---

## Still missing for upload-with-message

In priority order:

1. **C2 — Staged attachment state in composer**
   - `stagedAttachedFileIds: string[]` state in `TutorConversation`
   - Removable chip UI before send
   - Do NOT upload immediately on file selection (or keep two paths: panel upload vs. staged composer upload)

2. **C3 — Upload-with-message pipeline**
   - On send: upload staged files → create workspace file metadata → extract file IDs → include in `sendSessionMessage(...)` call
   - `handleFileSelected` must either return the created `fileId` or a separate staged-upload callback must exist
   - Failure path: if upload fails, block send with explicit error (not silent)

3. **C4 — Retrieval prioritization**
   - `fileChunkRetrievalService.ts`: new optional input `attachedFileIds?: string[]`
   - When present: boost or filter-first by those file IDs for current turn
   - Derive active context from latest prior user message with `attachedFileIds` when none in current turn
   - Preserve workspace-wide fallback when no attachment context exists

4. **C5 — Tutor wording update**
   - `sessionMessageApiService.ts` / tutor grounding: distinguish "file attached to this message" vs. "files in workspace"

---

## Recommended commit groups

### Group A — Project Brain
Files: `agent-memory/DUAL_AGENT_SYNC_LOG.md`, `agent-memory/CONVERSATION_FILE_ATTACHMENT_C1_DATA_MODEL_REPORT.md`, `agent-memory/DIAGRAM_AWARE_DEEP_PDF_DIAGNOSTIC.md`, plus `WORKING_TREE_CONSOLIDATION_AUDIT.md` (this file)

Message: `docs: update project brain — C1 report, diagram diagnostic, consolidation audit`

### Group B — Settings repair
Files: `next.config.ts`, `src/app/settings/page.tsx`, `src/lib/settings/settingsPreferences.ts`, `src/components/settings/ThemePicker.tsx`, `tests/app/settingsNavigationAndPersistence.test.ts`, `tests/app/settingsThemePlacement.test.tsx`, `tests/components/pageDiagnosticsToggle.test.ts`, `agent-memory/SETTINGS_NAVIGATION_AND_PERSISTENCE_REPAIR_REPORT.md`

Note: `src/app/page.tsx` is shared with C1 category — must decide which commit it belongs to. It carries both settings mount-time hydration AND upload context. Lean toward Group B if settings changes dominate, or split by diff hunks if possible.

Message: `fix: settings repair — persistence module, hydration, navigation, theme`

### Group C — Conversation attachment C1 (data model only)
Files: `src/types/index.ts`, `src/server/workspaces/workspaceTypes.ts`, `src/lib/sessions/sessionMessagesApiTypes.ts`, `src/server/workspaces/sessionMessageApiSchemas.ts`, `src/server/workspaces/messageRepository.ts`, `src/server/workspaces/sessionMessageApiService.ts`, `src/lib/sessions/sessionMessagesApiClient.ts`, `src/app/api/sessions/[sessionId]/messages/route.ts`, `tests/components/tutor/TutorConversation.test.tsx`, `tests/lib/sessions/sessionMessagesApiClient.test.ts`, `tests/server/workspaces/messageRepository.test.ts`, `tests/server/workspaces/sessionMessageApiRoute.test.ts`, `tests/server/workspaces/sessionMessageApiSchemas.test.ts`, `tests/server/workspaces/sessionMessageApiService.test.ts`, `agent-memory/CONVERSATION_FILE_ATTACHMENT_C1_DATA_MODEL_REPORT.md`

Message: `feat: C1 — add attachedFileIds to message type, schema, repository, API client`

### Group D — UI/Stitch visual pass
Files: `src/app/globals.css`, `src/components/files/FilePanel.tsx`, `src/components/layout/CollapsiblePanel.tsx`, `src/components/layout/MainLayout.tsx`, `src/components/tutor/TutorConversation.tsx`, `src/components/workspaces/WorkspaceSelector.tsx`, `src/components/ui/TutorUI.tsx`, `tests/components/workspaces/WorkspaceSelector.test.tsx`, `agent-memory/STITCH_DESIGN_GAP_ANALYSIS_AND_IMPLEMENTATION_PLAN.md`, `agent-memory/UI_UX_POLISH_PRODUCT_FEEL_REPORT.md`, `agent-memory/UI_VISUAL_ALIGNMENT_STITCH_PASS_REPORT.md`, `agent-memory/UI_VISUAL_DESIGN_CODEX_PASS_REPORT.md`

Message: `style: Stitch visual pass — layout, theme, components, composer`

### Group E — QA reports only (docs)
Files: `QA_GAP_REPORT.md`, `agent-memory/EXTERNAL_QA_GAP_RECONCILIATION_REPORT.md`

Message: `docs: QA gap report and external reconciliation report`

---

## Do not commit yet / needs review

| Item | Reason |
|---|---|
| `.tmp/stitch/` (all) | Generated artifacts; should be in .gitignore, not committed |
| `tests/firebase/workspacePersistence.emulator.test.ts` | Scope unclear — could be Settings repair, C1, or standalone. Inspect diff before assigning to a group |
| `src/app/page.tsx` | Spans multiple groups (Settings hydration + upload context). Inspect diff to determine dominant category before commit grouping |
| `src/components/tutor/TutorConversation.tsx` | If UI/Stitch pass changes overlap with C1 test expectations, splitting may be needed |

---

## Recommended next implementation batch

**C2 — Composer staged attachment UI**

Rationale: C1 backend is complete (type → schema → repository → service → client). The only blocker for a real end-to-end message-with-attachment test is the composer wire. C2 is the minimum viable surface to prove C1 is actually used. C3 (upload-with-message pipeline) and C4 (retrieval prioritization) follow naturally once C2 exists.

Do NOT proceed to C3 or C4 until C2 sends a real `attachedFileIds` value in the message request and the backend echo confirms persistence.

---

## Validation

- `npx tsc --noEmit --skipLibCheck`: **PASSED** (exit 0)
- `git diff --check`: **PASSED** (no whitespace errors)
- `graphify query`: run against 5 queries; confirmed graph nodes for TutorMessage, messageRepository, sendSessionMessage(), sessionMessageApiService, AppendMessageInput
- `vitest run`: NOT RUN (rolldown platform binary missing; last known: 77 passed / 18 skipped)
- `npm run build`: NOT RUN (would trigger Next.js build; safe to skip for audit)

---

## Safety

- I did not change code.
- I did not implement fixes.
- I did not run git add.
- I did not commit.
- I did not push.
- I did not run git pull.
