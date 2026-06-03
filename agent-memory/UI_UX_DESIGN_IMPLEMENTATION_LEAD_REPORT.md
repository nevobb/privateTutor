# UI/UX Design Implementation Lead Report

## 1. Branch / HEAD

- **Branch:** `repair/workspace-cleanup-fit-check`
- **HEAD before batch:** `b9259a0 feat: add sidebar conversation action menu`

---

## 2. Implementation strategy

Executed in dependency-safe order:

1. **`types/index.ts`** — additive type field first (foundation for source label change)
2. **`globals.css`** — CSS variables for chat size/width (foundation for component consumption)
3. **`FilePanel.tsx`** — isolated from TutorConversation, self-contained refactor
4. **`FilePanel.test.tsx`** — update 3 stale assertions + add new component tests
5. **`TutorConversation.tsx`** — largest change, depends on CSS vars being declared
6. **`TutorConversation.test.tsx`** — update layout test + add PlusMenu + source label tests
7. **`settings/page.tsx`** — new route, no dependencies on changed files
8. **`page.tsx`** — wire `onFileSelected`, add display settings loader, add Settings link, remove sidebar dev toggle

Preferred improving existing components over rewriting. All existing API/handler logic reused untouched.

---

## 3. Sidebar

- **Batch 10B already complete:** three-dot menu for conversation rename/delete was implemented prior to this batch — verified intact, no regression.
- Sidebar footer updated: removed developer diagnostics toggle (moved to Settings). Added a `⚙ Settings` link that navigates to `/settings`.
- `ThemePicker` kept in sidebar for quick palette access. Also available in Settings.
- Topics/Courses section label: not renamed (kept "Topics" — minor cosmetic change deferred to 10H).

---

## 4. Composer

**What changed in `TutorConversation.tsx`:**
- Removed `WorkModeSelector` and `CostModeSelector` from always-visible toolbar. Entire toolbar section deleted.
- Added a `+` button (`data-testid="plus-menu-button"`) to the left of the textarea.
- Added `PlusMenu` component (exported as named export):
  - **Upload file** — label with hidden `<input type="file">`, wired to `onFileSelected` prop
  - **Upload image** — disabled, "Soon" badge
  - **Mode: [current]** — click to expand inline list of all 5 work modes; selecting closes menu
  - **Cost: [current word]** — click to expand inline list of all 3 cost modes; selecting closes menu
- Plus menu closes on outside click (`mousedown` listener) or `Escape` key.
- Input bar layout changed: `[+]` `[textarea]` `[send]` (was `[send]` `[textarea]`).
- Textarea `minHeight` increased from `52px` to `60px`. `maxHeight` increased from `140px` to `160px`.
- `handleSubmit` height-reset updated to `60px`.
- Textarea `fontSize` now reads `var(--tutor-chat-font-size)`.
- Context strip simplified: removed "Mode:" interactive control. Now shows: `[mode badge]` `topic` `·` `sources count`. Mode badge is display-only (shows current mode abbreviation). Not interactive in the strip.
- New prop: `onFileSelected?: (file: File) => Promise<void>`.

---

## 5. FilePanel

**What changed in `FilePanel.tsx`:**
- Removed debug status codes `E:${extractionStatus}`, `C:${chunkingStatus}`, `Emb:${embeddingStatus}`.
- Removed `isReadyForLearning ? <span>Ready for learning</span> : null` inline display.
- Added `FileStatusLabel` component (exported):
  - All complete → `✓ Ready` (accent color, `data-testid="file-status-ready"`)
  - Any failed → `Failed` (red `#c0392b`, `data-testid="file-status-failed"`)
  - Otherwise → `Processing…` (muted, `data-testid="file-status-processing"`)
- Removed the flat "מחק" delete button.
- Added three-dot `⋯` button (`data-testid="file-menu-trigger"`) per file row.
- Added `FileRowMenu` component (exported):
  - **Delete** — active, calls existing confirmation flow
  - **Summarize** — disabled (`opacity-40`, `cursor-not-allowed`)
  - **Ask about file** — disabled
  - **Start learning** — disabled
  - Three disabled items are present in the menu but clearly inactive; they do not trigger fake behavior.
- Delete confirmation flow (`confirmDeleteFileId` state + Hebrew confirm) is unchanged.
- Added `openFileMenuId` state + `useEffect` for close-on-outside-click/Escape.
- Upload label button retained at top of panel (unchanged behavior).
- Added `useEffect` import.

---

## 6. Chat readability

**CSS variables added to `globals.css`:**
```css
--tutor-chat-font-size: 15px;   /* default: 15px (was 14px via text-sm) */
--tutor-chat-max-width: 680px;  /* default: 680px (was max-w-[72%]) */
```

**`MessageBubble` changes in `TutorConversation.tsx`:**
- Removed `text-sm` class
- Removed `max-w-[72%]` class
- Added inline `fontSize: "var(--tutor-chat-font-size)"` to both user and tutor bubble styles
- Added inline `maxWidth: "var(--tutor-chat-max-width)"` to both bubble styles
- `leading-relaxed` kept (consistent line-height)

**`page.tsx` change:**
- Added `useEffect` on mount to read `tutor-chat-font-size` and `tutor-chat-max-width` from localStorage and apply to `:root`. This ensures settings saved in `/settings` persist across page loads.

**Settings screen (`/settings`):**
- Font size: Small (13px) / Default (15px) / Large (17px) / X-Large (19px) pill buttons
- Message width: Narrow (520px) / Default (680px) / Wide (820px) / Full (95%) pill buttons
- Both write to localStorage and apply immediately via `document.documentElement.style.setProperty`

---

## 7. Sources

**`formatSourceLabel` rewritten:**
```ts
// Before:
function formatSourceLabel(citation: SourceCitation): string {
  const parts = citation.sourceId.split(":");
  if (parts.length >= 2) {
    const [fileId, chunkId] = parts;
    return `${fileId} • ${chunkId}`;   // ← raw UUIDs, illegible
  }
  return citation.sourceId;
}

// After:
function formatSourceLabel(citation: SourceCitation, index: number): string {
  if (citation.originalFileName) return citation.originalFileName;
  return `Source ${index + 1}`;        // ← "Source 1", "Source 2", etc.
}
```

`normalizeCitations` updated to pass `index` to `formatSourceLabel`.

`SourceCitation` type now has `originalFileName?: string` — when server provides it, the filename is shown. When absent, `Source N` ordinal is used. No raw `fileId:chunkId` strings are ever displayed to users.

The `<details>` collapsible pattern is preserved (still closed by default). No behavior change — only the source label text changed.

---

## 8. Settings / theme / dev controls

**New route: `/settings` (`src/app/settings/page.tsx`)**
- Display section: font size pills + message width pills
- Appearance section: `ThemePicker` (full component, user clicks "Customize colors" button to open modal)
- Advanced section: developer diagnostics toggle (reads/writes `privateTutor.devDiagnostics.enabled` to localStorage)
- Header with `‹ Back` link to `/`
- `/settings` builds as a static page (no server deps)

**Sidebar footer:**
- Removed developer diagnostics toggle
- Added `⚙ Settings` anchor link to `/settings`
- `ThemePicker` kept in sidebar

**Dev diagnostics flow:**
- Setting in `/settings` writes to localStorage key `privateTutor.devDiagnostics.enabled`
- On returning to `/`, `page.tsx` reads that key in its mount `useEffect` and sets `developerDiagnosticsEnabled` state accordingly
- No API or data model changes needed

---

## 9. Files changed

| File | Type | Change summary |
|------|------|----------------|
| `src/types/index.ts` | Modified | Added `originalFileName?: string` to `SourceCitation` |
| `src/app/globals.css` | Modified | Added `--tutor-chat-font-size: 15px` and `--tutor-chat-max-width: 680px` |
| `src/components/files/FilePanel.tsx` | Modified | `FileStatusLabel`, `FileRowMenu`, three-dot menu, removed debug codes |
| `src/components/tutor/TutorConversation.tsx` | Modified | Removed toolbar; added `PlusMenu`; CSS var sizing; fixed source labels; new `onFileSelected` prop |
| `src/app/page.tsx` | Modified | Added display settings `useEffect`; wired `onFileSelected`; Settings link; removed dev toggle from sidebar |
| `src/app/settings/page.tsx` | **Created** | Full Settings screen: font size, chat width, ThemePicker, dev diagnostics |
| `tests/components/files/FilePanel.test.tsx` | Modified | Updated 3 stale assertions; added `FileStatusLabel` + `FileRowMenu` tests |
| `tests/components/tutor/TutorConversation.test.tsx` | Modified | Updated layout test; added `PlusMenu` tests; added source label tests |

---

## 10. Tests added / updated

### FilePanel tests
- Updated `"shows Ready for learning..."` → `"shows ✓ Ready..."`  (×2 occurrences)
- Updated `"shows embedding status in the persisted file state summary"` → `"shows Failed status label when embedding failed"` — removes `Emb:failed` assertion
- Added `"does not show raw debug status codes"` — verifies no `E:completed`, `C:completed`, `Emb:completed`
- Added `FileStatusLabel` describe block: 5 tests (ready, processing, failed×2, no debug codes)
- Added `FileRowMenu` describe block: 4 tests (delete active, disabled items, role=menu, menuitem count)

### TutorConversation tests
- Updated `"renders send button outside textarea..."` → `"renders plus button left of textarea and send button right of textarea"` — new order: plus < textarea < send
- Added `"keeps plus button disabled when no active session"` 
- Added `PlusMenu` describe block: 9 tests (upload file, upload image/Soon, work mode label, cost mode label, work mode options when open, cost mode options when open, disabled without handler, not disabled with handler, role=menu)
- Added `source label formatting` describe block: 3 tests (Source N ordinal, originalFileName, no raw IDs)

### Totals
- Before: 947 tests (75 files)
- After: 991 tests (76 files, same files modified)
- Net gain: +44 tests

---

## 11. Validation

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ passed |
| `npx vitest run` | ✅ 76 files, 991 tests passed (+44 new), 121 skipped |
| `npm run build` | ✅ passed — `/settings` builds as static route |
| `git diff --check` | ✅ passed |
| `graphify update .` | ✅ 4718 nodes, 6411 edges, 311 communities |

---

## 12. Deferred

| Item | Reason deferred |
|------|----------------|
| Session-file attachment model (`primaryFileId`) | Per Nevo's explicit instruction — do not implement until separately proposed and approved |
| "Open file panel" in plus menu | Would require lifting `CollapsiblePanel` open state to `page.tsx` + adding `forceOpen` prop. Deferred to 10C follow-up. Currently the user can open the file panel from the sidebar. |
| Topic → "Courses" rename | Minor cosmetic; deferred to 10H visual polish |
| `ThemePicker` sidebar removal | Kept in sidebar for quick access. Full migration to Settings only is a future UX decision. |
| Full sources redesign (filename + page + quote + why) | Depends on Document Understanding Layer Phase C/D providing richer citation metadata. Current change makes labels readable; full redesign deferred. |
| Long-answer "split into cards" tutor behavior | Deferred — requires tutor behavior change (outside UI phase) |
| Mobile/touch adjustments | App is desktop-first per Batch 9B report. Deferred. |
| Arrow-key keyboard navigation within `PlusMenu` | Tab + Enter accessible. Full WAI-ARIA menu keyboard nav deferred. |

---

## 13. Risks / open decisions

| Risk | Status |
|------|--------|
| PlusMenu dropdown clipping in scroll container | Same pattern as ConversationMenu (Batch 10B). Acceptable for MVP. |
| `ThemePicker` in Settings renders a clickable button, not an always-expanded panel | Acceptable. User clicks to open the modal. Full "always-open" variant would require ThemePicker refactor — deferred. |
| Dev diagnostics: toggling in Settings requires navigating back to `/` to see effect | By design. The `useEffect` in `page.tsx` reads localStorage on mount. Changing in Settings → navigating back → effect visible. No cross-page live-sync needed. |
| `originalFileName` on SourceCitation not yet populated by server | The field is optional. When absent, `Source N` is shown. Full filename display requires server-side enrichment of citation objects — deferred to Document Understanding phase. |
| `onFileSelected` conditioned on `authState + activeWorkspaceId` | Correct — the upload function requires auth and workspace. Plus menu's file input is `disabled` when `onFileSelected` is undefined, so no silent no-op. |

---

## 14. Recommended next UI step

**10C-continued: Wire "Open file panel" in plus menu**

Lift `filePanelOpen: boolean` state to `page.tsx`, pass `forceOpen` prop to the `CollapsiblePanel` for "Study materials", and pass `onToggleFilePanel` to `TutorConversation`. Small, isolated, safe.

Alternatively: **10D — FilePanel visual simplification pass** (spacing, typography, palette consistency, ensure it looks clean in the sidebar without being dominant).

---

## 15. Ready for Nevo manual UI smoke?

**YES**

The following minimum targets from the spec are met:

| Target | Status |
|--------|--------|
| Sidebar conversation actions use three-dot menu | ✅ (Batch 10B + verified this batch) |
| WorkMode/CostMode no longer always-visible controls | ✅ Toolbar removed; mode pickers now in `+` menu |
| Composer has a plus menu | ✅ `+` button with popover |
| Upload file accessible from composer | ✅ Via plus menu file input |
| File panel less dominant, visually simpler | ✅ No debug codes; three-dot file actions |
| File rows hide debug status codes | ✅ Replaced with `✓ Ready` / `Processing…` / `Failed` |
| Chat readability improved | ✅ 15px default font, 680px max-width, 60px input min-height |
| Sources display less noisy | ✅ `Source N` ordinals instead of raw `fileId:chunkId` UUIDs |
| Theme/dev controls toward Settings | ✅ `/settings` route created; dev toggle moved there; Settings gear in sidebar |

---

## 16. Safety confirmations

- I did not change tutor reasoning.
- I did not change retrieval logic.
- I did not change Deep PDF behavior.
- I did not change upload/extract/chunk backend behavior.
- I did not change soft delete semantics.
- I did not implement primaryFileId/attachedFileIds.
- I did not change learner memory.
- I did not change authentication behavior.
- I did not run `git add`.
- I did not commit.
- I did not push.
- I did not run `git pull`.

---

*Report created: 2026-06-03*
*Next step: 10C — open file panel wiring OR 10D visual polish pass*
