# Course Knowledge Context Picker — Fit Check

**Date:** 2026-06-03
**Branch:** repair/workspace-cleanup-fit-check
**HEAD:** 43b38d1 feat: wire composer attachments into message send
**Type:** Diagnostic / planning only. No code changed.

---

## 1. Brain files read

- `AGENTS.md`
- `agent-memory/PROJECT_BRAIN/00_CURRENT_STATE.md`
- `agent-memory/PROJECT_BRAIN/01_SYSTEM_PIPELINE_CONTRACTS.md`
- `agent-memory/PROJECT_BRAIN/02_CHANGE_IMPACT_MATRIX.md`
- `agent-memory/PROJECT_BRAIN/03_RISK_REGISTER.md`
- `agent-memory/PROJECT_BRAIN/04_AGENT_PREFLIGHT_PROTOCOL.md`
- `agent-memory/CONVERSATION_FILE_ATTACHMENT_FIT_CHECK.md`
- `agent-memory/CONVERSATION_FILE_ATTACHMENT_C2_C3_COMPOSER_UPLOAD_WIRE_REPORT.md`
- `agent-memory/CONVERSATION_FILE_ATTACHMENT_C4_RETRIEVAL_READINESS_REPORT.md`
- `agent-memory/ATTACHMENT_FAILURE_DIAGNOSTIC_REPORT.md`

## 2. Graphify queries run

- `TutorConversation stagedAttachments attachedFileIds plus menu`
- `FilePanel uploaded files processing status`
- `workspace files list ready processing status`
- `attachedFileIds retrieval prioritization ready files`
- `plus menu upload file course materials context picker`
- `Study Materials drawer selected files conversation context`

---

## 3. Product problem summary

C3 (upload-on-send) works technically but creates a broken UX loop:

1. User attaches a brand-new file from plus menu
2. File is staged (no upload yet) — chip shows
3. User sends a message
4. Upload starts: storage + metadata created
5. Processing pipeline starts but is **fire-and-forget** (20–120s for a PDF)
6. Backend readiness gate fires immediately: file is not extracted/chunked yet
7. Tutor responds: *"הקובץ שצירפת עדיין בעיבוד..."*
8. User must wait, then re-ask — with no indication of when it will be ready

This is a **fundamental timing mismatch**, not a bug. PDF processing cannot reliably complete between "send" and "server receives request."

The correct mental model for privateTutor is:
- Study Materials / Knowledge Base = persistent course content, pre-processed
- Conversation context = select from already-processed course materials

---

## 4. Current flow (C2/C3/C4 state)

```
Plus menu "Upload file"
  → handleStageAttachment(file: File)
  → StagedAttachment { localId, file: File } added to state
  → Chip shown in composer

User sends message
  → handleSubmit loops staged attachments
  → onUploadAttachmentFile(file) called per staged file
    → handleAttachmentUpload: validates → storage → metadata → createdFile.id
    → runFileProcessingPipeline (fire-and-forget, returns immediately)
    → returns createdFile.id
  → sendSessionMessage({ ..., attachedFileIds: [id1, id2] })
  → Backend: validateAttachedFileIds (ownership check)
  → Backend: appendMessage (persists attachedFileIds)
  → C4 readiness gate: extractionStatus != 'completed' → "still processing" response
  → No retrieval, no tutor provider call

Follow-up turns (after file is eventually ready):
  → deriveActiveAttachedFileIds finds prior message's attachedFileIds
  → readiness gate passes
  → retrieveFileChunks called with prioritizedFileIds = [id1, id2]
  → Tutor answers from attached file
```

**What works correctly:** C1 persistence, C4 readiness gate, C4 retrieval prioritization, C4 history derivation, the chip UI concept.

**What is broken by design:** C3 upload-on-send timing. The processing race is inherent.

---

## 5. Recommended new flow

```
Study Materials (FilePanel)
  → User uploads PDF/DOCX → immediate workspace KB upload
  → Processing pipeline runs in background
  → FilePanel shows processing status, then "Ready for learning"

Plus menu (new behavior)
  → "Add to study materials" — triggers existing FilePanel upload path
  → No attachment chip, no staged file
  → OR: shows existing course files for selection (see UX options below)

"Use in chat" on FilePanel ready file
  → User clicks "Use in chat" / "בחר להקשר" on a ready file in FilePanel
  → File ID + name added to staged context chips in composer
  → Chip shows file name + remove button
  → No upload needed (file already processed)

User sends message with context chips
  → handleSubmit reads stagedAttachments: [{ localId, fileId, fileName }]
  → No upload — just collects fileIds
  → sendSessionMessage({ ..., attachedFileIds: [fileId1, fileId2] })
  → C4 readiness gate passes (file was ready when user selected it)
  → Retrieval prioritizes selected files
  → Tutor answers from selected files
```

---

## 6. What to keep from C1/C2/C3/C4

| Component | Keep / Change |
|---|---|
| C1: `attachedFileIds` on message type/schema/repository/client | **KEEP** — fully correct |
| C1: `validateAttachedFileIds` service check | **KEEP** — safety boundary |
| C2: `StagedAttachment` chip concept in TutorConversation | **KEEP** — repurpose to hold `{ fileId, fileName }` not `{ file: File }` |
| C2: Chip UI (show/remove before send) | **KEEP** — correct UX |
| C3: `onUploadAttachmentFile` prop on TutorConversation | **REMOVE** — upload-on-send path removed |
| C3: `handleAttachmentUpload` in page.tsx | **REMOVE** — upload-on-send path removed |
| C3: Upload inside `handleSubmit` loop | **REMOVE** — replaced with direct fileId collection |
| C4: `deriveActiveAttachedFileIds` | **KEEP** — follow-up turns still need context derivation |
| C4: Readiness gate | **KEEP** — safety net; won't fire in normal flow if only ready files selectable |
| C4: `prioritizedFileIds` in retrieval | **KEEP** — core feature |
| `StagedAttachment` type | **CHANGE** — from `{ localId, file: File }` to `{ localId, fileId, fileName }` |
| `handleStageAttachment` logic | **REPURPOSE** — accept `(fileId, fileName)` not `file: File` |

---

## 7. What to change

### TutorConversation.tsx
- `StagedAttachment`: change `file: File` → `fileId: string; fileName: string`
- `handleStageAttachment`: accepts `(fileId: string, fileName: string)` not `(file: File)`
- `handleSubmit`: drop upload loop; collect `att.fileId` directly as `attachedFileIds`
- Remove `onUploadAttachmentFile` prop entirely
- Remove `handleUploadWithFeedback` (or keep only for legacy fallback)
- Chip display: use `att.fileName` instead of `att.file.name`
- `buildStagedAttachment`: change signature to accept `{ fileId, fileName }`
- New prop: `onAddContextFile?: (fileId: string, fileName: string) => void` passed outward (OR lift state to page.tsx — see below)

### FilePanel.tsx
- Add `onUseInChat?: (fileId: string, fileName: string) => void` prop
- On ready files (`isReadyForLearning === true`), show "Use in chat" / "בחר להקשר" button
- On non-ready files: button absent or disabled with status label
- No change to existing upload behavior

### page.tsx
- Remove `handleAttachmentUpload` callback
- Remove `onUploadAttachmentFile` prop from TutorConversation
- Two design options for state management (see below):
  - **Option I: Lift staged state to page.tsx** — `page.tsx` owns `stagedAttachments`; passes down to both TutorConversation and FilePanel
  - **Option II: Keep staged state in TutorConversation + ref** — TutorConversation exposes an imperative `addContextFile(fileId, fileName)` via React ref; FilePanel calls it via page.tsx callback

**Recommended: Option I (lift state to page.tsx)**
- Simpler data flow, no imperative refs
- `page.tsx` provides `handleFileUseInChat = (fileId, fileName) => setStagedAttachments(prev => [...prev, buildStagedAttachment({fileId, fileName})])`
- `FilePanel` receives `onUseInChat={handleFileUseInChat}`
- `TutorConversation` receives `stagedAttachments` (display only) and `onRemoveStagedAttachment` as props
- `handleSubmit` in TutorConversation receives `stagedAttachments` via prop and uses `att.fileId`

### Plus menu behavior
- "Upload file" → remains in plus menu BUT now means "Add to study materials"
- Uses existing `handleFileSelected` path (immediate workspace upload, no chip)
- Label could stay or change to "Add course material"
- Either way: no attachment chip from this path, no upload-on-send

---

## 8. UX options A/B/C comparison

### Option A — Plus menu file picker
Plus menu shows existing course files; user selects one → chip appears.

| Aspect | Assessment |
|---|---|
| Discoverability | High — user already goes to plus menu |
| Implementation complexity | High — need file list sub-panel inside ActionMenu, loading state, filter by ready |
| Data dependency | `uploadedFiles` must be passed to TutorConversation or fetched there |
| Collision with upload item | Plus menu already has "Upload file"; must distinguish clearly |
| When files are still processing | Sub-panel shows disabled items with status |
| MVP fit | Complex — requires file list in plus menu |

### Option B — FilePanel "Use in chat" button
FilePanel shows "Use in chat" on ready files; click stages the file as context chip.

| Aspect | Assessment |
|---|---|
| Discoverability | Moderate — user must open Study Materials panel |
| Implementation complexity | Low — one new button in FilePanel, lift staged state to page.tsx |
| Data dependency | None new — FilePanel already has the ready file objects |
| Context clarity | Excellent — user sees the file in study materials, then explicitly selects it |
| When files are still processing | Button absent or disabled on non-ready files |
| MVP fit | Simple — minimal code, no new API, no new data fetch |

### Option C — Both A and B
FilePanel has "Use in chat" AND plus menu has a file picker.

| Aspect | Assessment |
|---|---|
| UX richness | Best — two entry points |
| Implementation complexity | High — requires both B and A |
| MVP fit | Good for V2, not MVP |

---

## 9. Recommended MVP option

**Option B: FilePanel "Use in chat" button**

Rationale:
- FilePanel already renders every file with its processing status
- `isReadyForLearning` (extraction + chunking + embedding complete) is already computed per file in `FilePanel.tsx:103–106`
- Users who care about which file to discuss can naturally browse Study Materials and click "Use in chat"
- No new data plumbing needed — just a callback prop
- Lowest regression risk: no changes to plus menu navigation, no sub-panel rendering
- Can add Option A later without breaking Option B

Additionally: the plus menu "Upload file" item should be visually relabeled to "Add to study materials" (or the existing label kept) but its behavior remains the existing `handleFileSelected` immediate workspace upload path — no chip, no staging.

---

## 10. Ready-file definition

**Use the existing `FilePanel.tsx` definition, which matches C4:**

```typescript
isReadyForLearning =
  extractionStatus === "completed" &&
  chunkingStatus === "completed" &&
  embeddingStatus === "completed"
```

Three conditions, all required:
- `extractionStatus === "completed"` — text extracted (required for any retrieval)
- `chunkingStatus === "completed"` — text chunked (required for chunk retrieval)
- `embeddingStatus === "completed"` — embeddings computed (required for semantic retrieval)

This is STRICTER than C4's readiness gate (`extractionStatus + chunkingStatus` only). The reason to use the stricter definition for the picker: we want to surface files that are fully ready for the best retrieval (semantic + keyword), not just keyword-fallback-ready.

C4's readiness gate can stay at `extractionStatus + chunkingStatus` as the backend safety check. The picker shows only files where all three are complete.

---

## 11. Exact files likely to change

| File | Change type |
|---|---|
| `src/components/tutor/TutorConversation.tsx` | Change `StagedAttachment` type; change staged state to be prop-driven; change `handleSubmit` (no upload loop); remove `onUploadAttachmentFile` prop; update chip display |
| `src/components/files/FilePanel.tsx` | Add `onUseInChat?: (fileId, fileName) => void` prop; add "Use in chat" button on `isReadyForLearning` files |
| `src/app/page.tsx` | Lift `stagedAttachments` state; add `handleFileUseInChat` callback; remove `handleAttachmentUpload`; remove `onUploadAttachmentFile` prop on TutorConversation; pass new props to FilePanel |
| `tests/components/tutor/TutorConversation.test.tsx` | Update `StagedAttachment` tests; update chip tests; add tests for fileId-based staged attachments |
| `tests/components/files/FilePanel.test.tsx` | Add tests for "Use in chat" button on ready files |

**No backend changes needed:**
- `sessionMessageApiService.ts` — C4 already correct
- `fileChunkRetrievalService.ts` — C4 already correct
- `sessionMessageApiSchemas.ts` — C1 already correct
- `messageRepository.ts` — C1 already correct
- `sessionMessagesApiClient.ts` — C1 already correct

---

## 12. Implementation batches

### C5B — Repurpose staged attachment to file-picker model
1. Change `StagedAttachment` type: `{ localId: string; fileId: string; fileName: string }`
2. Lift `stagedAttachments` state to `page.tsx`
3. Update `TutorConversation` props: remove `onUploadAttachmentFile`, add `stagedAttachments` + `onRemoveStagedAttachment` as explicit props
4. Update `handleSubmit` in TutorConversation: remove upload loop, use `att.fileId` directly
5. Update chip display: `att.fileName` instead of `att.file.name`
6. Remove `handleAttachmentUpload` from page.tsx
7. Update tests

### C5C — FilePanel "Use in chat" button
1. Add `onUseInChat?: (fileId: string, fileName: string) => void` prop to FilePanel
2. Add "Use in chat" / "בחר להקשר" button on `isReadyForLearning` files in FilePanel
3. Add `handleFileUseInChat` in page.tsx; pass to FilePanel
4. Add tests for FilePanel "Use in chat"

### C5D (optional, later) — Plus menu course file picker
1. Pass `uploadedFiles` (or a filtered `readyFiles`) into TutorConversation as prop
2. Add a sub-panel in PlusMenu to pick from ready files
3. Clicking a file calls a staging callback

### C5E (optional) — Plus menu "Upload" relabel
1. Change plus menu "Upload file" label to "Add to course" or "Add study material"
2. Behavior unchanged (existing `handleFileSelected` immediate workspace upload)

---

## 13. Risks / open decisions

| Item | Status | Notes |
|---|---|---|
| Stage state lift to page.tsx | Design decision | Cleaner than imperative ref; page.tsx already has all upload state |
| `onFileSelected` on TutorConversation | Can remove once plus menu uses study materials path | Keep as fallback for now |
| "Use in chat" on partially-ready files | Policy: button only on `isReadyForLearning` (all 3 complete) | C4 gate still catches edge cases |
| Multiple context files from same workspace | Allowed — user can select multiple ready files; C4 prioritizes all of them | No change needed |
| Removing existing C2/C3 test coverage for file: File staging | Must update tests to new type | Tests for `buildStagedAttachment`, chip display need new fixtures |
| FilePanel "Use in chat" while file is in-flight context | Edge case: if user selects a file then it gets soft-deleted before send | C4 readiness gate + `validateAttachedFileIds` handles this safely |
| Plus menu "Upload file" label change | Cosmetic — can be deferred | Product clarity improves with new label |
| C4 readiness gate remains | Stays as safety net | In normal flow with ready-only picker, gate will pass without issue |

---

## 14. Whether current code should be reverted or repurposed

**Do NOT revert C1, C4.**
- C1 (`attachedFileIds` type/schema/repo/client): correct, stays exactly as-is
- C4 (readiness gate, `deriveActiveAttachedFileIds`, `prioritizedFileIds`): correct, stays exactly as-is

**Repurpose, not revert, C2/C3:**
- C2 (staged attachment state + chip UI): repurpose — change `StagedAttachment.file: File` → `StagedAttachment.fileId: string + fileName: string`; lift state to page.tsx
- C3 (upload-on-send): remove — `onUploadAttachmentFile` prop and `handleAttachmentUpload` callback deleted

**No revert needed.** The `StagedAttachment` concept and chip UI are correct — only the data model for what is "staged" changes (file object → file ID reference).

---

## 15. Validation

- `npx tsc --noEmit --skipLibCheck`: **PASSED** (exit 0)
- `npx vitest run --exclude 'tests/evaluation/**'`: **1058 passed / 0 failed** (78 files, 18 skipped)
- `git diff --check`: **PASSED**
- `graphify update .`: (already updated in C4 session)

---

## 16. Ready for implementation

**YES**

The plan is clear, bounded, and safe:
- C5B: repurpose staged type + lift state (3 files, backward-compatible with C1/C4)
- C5C: FilePanel "Use in chat" button (2 files, additive)
- No backend changes needed

Start with C5B (core refactor), then C5C (UI addition). C5D and C5E are optional polish.

---

## Safety

- I did not change code.
- I did not change UI.
- I did not change backend.
- I did not change retrieval.
- I did not run git add.
- I did not commit.
- I did not push.
- I did not run git pull.
