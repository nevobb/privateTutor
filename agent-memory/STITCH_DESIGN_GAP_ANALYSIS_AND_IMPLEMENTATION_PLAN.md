# Stitch Design Gap Analysis and Implementation Plan

## 1. Branch name and HEAD commit
- Branch: `repair/workspace-cleanup-fit-check`
- HEAD: `e162e26 feat: improve workspace UI and composer actions`

## 2. Stitch files/screens reviewed
Note: the user-requested path `design-references/stitch_academic_workspace_privatetutor/` is not present in the repo. The actual local Stitch export available for review is:

- `.tmp/stitch/stitch_academic_workspace_privatetutor/academic_clarity/DESIGN.md`
- `.tmp/stitch/stitch_academic_workspace_privatetutor/main_workspace_plus_menu/screen.png`
- `.tmp/stitch/stitch_academic_workspace_privatetutor/main_workspace_plus_menu/code.html`
- `.tmp/stitch/stitch_academic_workspace_privatetutor/settings/screen.png`
- `.tmp/stitch/stitch_academic_workspace_privatetutor/settings/code.html`
- `.tmp/stitch/stitch_academic_workspace_privatetutor/study_materials_drawer/screen.png`
- `.tmp/stitch/stitch_academic_workspace_privatetutor/study_materials_drawer/code.html`
- `.tmp/stitch/stitch_academic_workspace_privatetutor/expanded_sources_view/screen.png`
- `.tmp/stitch/stitch_academic_workspace_privatetutor/expanded_sources_view/code.html`
- `.tmp/stitch/stitch_academic_workspace_privatetutor/empty_states/screen.png`
- `.tmp/stitch/stitch_academic_workspace_privatetutor/empty_states/code.html`

## 3. Current UI summary
- The current app is structurally aligned with the intended product: left sidebar, dominant main chat, course/workspace nesting, study materials drawer, settings page, and premium-leaning warm-neutral styling.
- The latest visual pass improved surface quality, hierarchy, and composer feel, but the app still reads as a simplified implementation of the reference rather than a fully resolved learning workspace.
- Message rendering still lives inline inside `src/components/tutor/TutorConversation.tsx`; there is no separate `src/components/tutor/TutorMessage.tsx`.
- Settings now visually owns palette controls, but the route appears behaviorally broken: in browser automation the page renders, yet control clicks do not mutate localStorage or root CSS variables.
- Conversation rename/delete and file delete exist. Workspace/course delete does not safely exist end-to-end and should remain out of scope.

## 4. Stitch design summary
- The Stitch direction is a calm “academic paper + modern workspace” system, not a dashboard.
- It uses:
  - warm paper-like background neutrals
  - Hanken Grotesk for UI chrome
  - Source Serif 4 for reading surfaces
  - restrained tonal layers instead of heavy shadows
  - 720px reading column
  - soft but architectural 12px/16px radius language
- The reference includes several advanced concepts beyond current privateTutor:
  - editorial top navigation concepts (`Documents`, `Flashcards`, `Research`)
  - richer empty states
  - a dedicated study materials drawer with category tabs
  - a fuller sources card system with filename/page/quote grouping
  - stronger notebook/page-like assistant response presentation
  - more explicit content-area framing instead of “app shell”

## 5. Gap analysis table

| Area | Current privateTutor | Stitch reference | Gap | Classification |
|---|---|---|---|---|
| Overall shell | Stronger app-shell feel, dark sidebar, utility chrome | Lighter editorial workspace with calmer canvas | Needs more tonal hierarchy reduction and reading-stage framing | Visual-only |
| Sidebar identity | Good structure, but still compact and app-like | Cleaner academic nav with more breathing room | Further spacing/typography polish possible | Visual-only |
| Course/session hierarchy | Functional nesting under course | Cleaner course/lesson branch treatment | Mostly polish; behavior already acceptable | Visual-only |
| Chat stage | Good centered column, still simplified | More notebook/page feel, richer AI card treatment | Need more typography and content-card refinement | Visual-only |
| Composer | Premium compared with older versions | Even more intentional primary action bar | Further polish possible without backend changes | Visual-only |
| Plus menu | Works for upload/mode/cost | Reference feels cleaner and more integrated | Menu polish only; no product gap | Visual-only |
| Study materials panel | Collapsible sidebar panel with calm rows | Dedicated right-side drawer with filters and stronger structure | Layout difference is real, but tabs/filters exceed current scope | Mixed: visual-only + future feature |
| File actions | Delete works, other actions disabled | Ask/Summarize/Start learning shown in menu | Current app correctly disables unavailable actions | Future feature for richer items |
| Sources | Quiet fallback labels, collapsible quotes | Richer citations with filename/page/quote grouping | Blocked by metadata richness | Product/data-model change |
| Settings visuals | Good layout, but simpler than Stitch | Better section rhythm and product integration | Mostly polish, but current route is functionally broken first | Existing bug + visual-only |
| Settings behavior | Controls render but do not persist in live check | Fully interactive preferences | Broken hydration/wiring | Existing bug |
| Empty states | Minimal current empty handling | Strong guided states for no course/no chat/no messages | Safe to implement later as UI-only | Visual-only |
| Typography system | Manrope + Lora | Hanken Grotesk + Source Serif 4 | Font direction still not fully aligned | Visual-only |
| Shadows/depth | Good, but blur/surface treatment still app-like | Tonal layers, restrained shadows, crisp cards | Refine later | Visual-only |
| Conversation rename | Implemented but sometimes times out | Should feel instantaneous/reliable | Client timeout / late success issue | Existing bug |
| Upload-from-chat context | Upload reaches workspace materials only | Reference implies active-learning material workflow | No current conversation-file model | Product/data-model change |
| Workspace delete | Missing | Not shown as a fake placeholder | Correctly absent for now | Product/data-model change |

## 6. Gap classification

### Visual-only
- Further soften overall shell and reduce leftover app-chrome feel
- Refine sidebar spacing/typography rhythm
- Improve assistant response card polish and reading typography
- Improve empty states
- Further align font system toward Stitch’s serif/sans split
- Refine tonal elevation, radius, and container rhythm

### UI wiring
- Use `next/link` or equivalent client navigation for Settings entry/Back flow instead of raw anchors
- Add interaction tests for Settings controls and route navigation
- Potentially move study materials from collapsible sidebar panel to a slide-over/drawer, if done without changing backend/data semantics

### Existing bug
- Settings route freeze / slow enter-leave
- Settings controls not responding or persisting
- Conversation rename timing out despite eventual success

### Product/data-model change
- Session-level file attachment / primary context model
- Richer source metadata (page/section/question grouping)
- Safe workspace/course soft delete/archive

### Future feature
- Flashcards / Research / Documents tabs
- Study materials category filters (`Readings`, `Assignments`, `Lab Notes`, `Syllabus`)
- Richer file actions beyond delete
- Share/search/notification style shell features from Stitch

## 7. Settings freeze analysis

### What the code shows
- `/settings` is a client component (`"use client"`).
- It imports only local UI pieces plus `ThemePicker`; it does not import Firebase auth or chat state.
- Navigation to and from Settings currently uses plain `<a href="/settings">` and `<a href="/">`, not `next/link`.

### What the live diagnostic showed
- The route rendered in Playwright.
- Warm navigation timing on direct load was about `1.5s`, not `10–15s`.
- However, control clicks did not mutate localStorage or CSS vars even after waiting `12s`.

### Likely diagnosis
This is probably two overlapping issues:

1. **Route-entry slowness is at least partly navigation behavior**
   - Using raw anchors causes full document reload instead of App Router client navigation.
   - In dev, that amplifies route compilation/HMR/auth boot cost and can feel like a “freeze.”
   - Leaving Settings back to `/` also triggers full app reload and auth/bootstrap work again.

2. **There is also a client interactivity/hydration failure on `/settings`**
   - In live automation, the page rendered but button clicks did not update state, localStorage, or root CSS variables.
   - That strongly suggests the page is not actually becoming interactive in this environment, which is worse than simple dev slowness.
   - No page errors surfaced, so this is likely a hydration/runtime attachment problem rather than a thrown exception in handlers.

### Most likely repair direction
- Treat this as an **existing bug**, not a design issue.
- First repair batch should instrument and isolate:
  - client navigation vs full reload
  - whether Settings actually hydrates
  - whether `ThemePicker` or route composition is preventing mount/interactivity
  - whether Turbopack/HMR-specific behavior is masking a route bug

## 8. Settings persistence analysis

### What the code intends to do
- `src/app/settings/page.tsx`
  - `handleFontSize` writes `tutor-chat-font-size`
  - `handleChatWidth` writes `tutor-chat-max-width`
  - `handleDevDiagnostics` writes `privateTutor.devDiagnostics.enabled`
  - `applyVar(...)` writes CSS variables on `document.documentElement`
- `src/app/page.tsx`
  - mount effect reads `tutor-chat-font-size` / `tutor-chat-max-width`
  - separate effect reads/writes `privateTutor.devDiagnostics.enabled`

### What is actually missing
- There are only static render tests for Settings placement.
- There are no interaction tests proving:
  - option pills call handlers
  - localStorage updates
  - CSS vars update
  - theme changes persist
- Live automation showed no localStorage writes and no CSS-var mutations after clicking Settings controls.

### Likely diagnosis
- The persistence logic itself is simple and probably not the conceptual problem.
- The bigger issue is that the route is not hydrating or not attaching event handlers correctly, so the handlers never run.
- This should be classified as an **existing bug**, not as a missing feature.

## 9. Rename timeout analysis

### What the current flow does
- `WorkspaceSelector` waits for `onRenameSession(...)` to resolve before exiting rename mode.
- `page.tsx` calls `renameSession(...)` in `sessionApiClient`.
- `sessionApiClient` uses an `AbortController` with a hard `8000ms` timeout.
- Server rename path:
  - auth
  - parse body
  - `sessionApiService.renameSessionForUser(...)`
  - `sessionRepository.updateSession(...)`
- Repository rename does:
  - `assertWorkspaceOwnership(...)` (read workspace)
  - read session
  - update session title

### Why “error but eventually succeeds” is plausible
- Client-side timeout aborts after 8 seconds.
- Server work is not guaranteed to stop just because the browser aborted.
- If Firestore/auth/server latency is high enough, the write can complete after the client gives up.
- The user then sees an error while the rename has in fact persisted.

### Likely diagnosis
- This is an **existing bug** caused by a too-tight client timeout combined with a synchronous “wait for server then close editor” UI flow.
- The issue is not the design itself.

### Safe repair options later
- increase rename request timeout
- optimize server rename path
- add late-success recovery or optimistic rename UI with rollback only on confirmed failure

## 10. Upload-to-conversation-context analysis

### What exists today
- Upload from the composer calls `TutorConversation -> handleUploadWithFeedback -> onFileSelected -> page.tsx handleFileSelected`.
- `handleFileSelected`:
  - uploads the file to storage
  - creates workspace file metadata
  - reloads workspace files
  - starts extraction/chunking/embedding pipeline
- The file becomes part of the **workspace knowledge base**.

### What does not exist
- `SessionRecord` has no `primaryFileId`.
- `SessionRecord` has no `attachedFileIds`.
- `sendSessionMessage(...)` does not send file attachment metadata.
- There is no message attachment model.
- Retrieval in `fileChunkRetrievalService.ts` works across eligible files in the workspace, not the current conversation’s selected file.

### Direct answer
- Does `SessionRecord` have `primaryFileId` or `attachedFileIds`?  
  No.
- Are message attachments modeled?  
  No.
- Does upload from composer send file with message or immediately upload?  
  It immediately uploads to workspace storage/metadata and starts processing; it is not attached to the message.
- How does the tutor know which file is “in this conversation”?  
  It currently does not. It only knows the workspace and retrieves across workspace-level eligible materials.
- What minimal future model is needed?  
  A session-level file association model, likely `primaryFileId` plus optional `attachedFileIds`, and retrieval prioritization/filtering that uses that session context.

### Classification
- This is a **product/data-model change**, not a visual or UI-only task.

## 11. Workspace/course delete analysis
- Current audit still stands:
  - `workspaceApiClient` supports fetch/create only
  - `/api/workspaces` supports `GET` and `POST`
  - `/api/workspaces/[workspaceId]` supports `GET` only
  - `workspaceApiService` and `workspaceRepository` do not expose safe delete/archive behavior
- `WorkspaceStatus` includes `deleted`, but there is no safe end-to-end implementation behind it.
- Therefore:
  - do not restore delete UI now
  - do not fake disabled clickable delete actions
  - handle this as a separate backend-safe batch later

## 12. Recommended implementation roadmap

### 1. Bug Fix Batch A — Settings Navigation and Persistence Repair
- Goal: make `/settings` interactive, fast enough, and persistent before any more visual polishing.
- Scope:
  - diagnose hydration/interactivity failure
  - replace raw anchors with client navigation
  - add interaction tests for pills, toggle, theme persistence
  - verify page-enter/page-leave behavior in real browser

### 2. Bug Fix Batch B — Rename Timeout and Late Success Repair
- Goal: make conversation rename reliable and truthful.
- Scope:
  - analyze client timeout vs server latency
  - adjust timeout/retry or optimistic UI strategy
  - add tests for timeout/late-success handling if feasible

### 3. Product Batch C — Conversation File Attachment Model / Upload-With-Message Flow
- Goal: let a file uploaded from chat become explicit conversation context, not only workspace knowledge.
- Scope:
  - propose/approve session-level file linkage
  - wire retrieval prioritization
  - update composer/upload semantics carefully
- This batch is product/data-model work and should not be mixed into visual cleanup.

### 4. Visual Batch D — Stitch Alignment on Safe Visual/UI Gaps
- Goal: finish the safe visual gaps after the broken settings route is repaired.
- Scope:
  - typography alignment
  - assistant card refinement
  - sidebar rhythm
  - empty states
  - tonal depth cleanup
  - possibly study-materials drawer presentation if kept UI-only

### 5. Product Batch E — Sources Redesign After Metadata Improves
- Goal: only redesign sources once filename/page/section/question metadata is rich enough to make the UI meaningful.

### 6. Product Batch F — Workspace/Course Soft Delete
- Goal: add safe workspace archive/soft-delete only after backend-safe semantics are designed and implemented.

### 7. Future — Advanced Stitch Concepts
- Flashcards / Research / document tabs
- richer materials categorization
- share/search/notification extras

## 13. What should not be implemented yet
- `primaryFileId` / `attachedFileIds` without a separate approved product batch
- workspace/course delete UI without backend-safe archive/delete support
- flashcards
- research tabs
- fake richer source metadata
- fake “attached file” behavior
- fake file panel actions that imply unavailable backend capability
- broad shell features from Stitch (`Share`, notifications, library/archive ecosystems) unless explicitly prioritized

## 14. Validation results
- `git branch --show-current` → `repair/workspace-cleanup-fit-check`
- `git status --short` checked
- `git log --oneline -15` checked
- `npx tsc --noEmit` → passed
- `npx vitest run` → passed (`77 passed`, `18 skipped`)
- `npm run build` → passed
- `git diff --check` → passed
- `graphify update .` → passed

## 15. Risks / open decisions
- The biggest open question is the exact root cause of the broken Settings interactivity. The evidence shows the bug is real, but the failure mode still needs targeted debugging.
- The user-requested design path is missing from the repo; future design tasks should point to the actual checked-in reference path.
- The repo’s current worktree is already dirty with uncommitted UI work. Any repair batch must be careful not to blur scope.
- Sources redesign should wait for metadata quality; otherwise the UI will look polished but still say very little.

## 16. Ready for first repair batch?
- YES

## 17. Recommended first repair batch name
- `Bug Fix Batch A — Settings Navigation and Persistence Repair`

## 18. Confirmation that no code was changed
- Confirmed. No application code was changed for this task.
- Only diagnostic/report artifacts are appropriate for this planning pass.

## 19. Confirmation that no git add / commit / push was run
- Confirmed. No `git add`, commit, or push was run.

## 20. Confirmation that no git pull was run
- Confirmed. No `git pull` was run.
