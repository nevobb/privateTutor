# UI/UX Polish — Product Feel

## 1. Upload feedback

### Problem
When a file was uploaded from the composer plus menu, there was no visible feedback in the chat area. The upload status only appeared inside the sidebar's "Study materials" collapsible panel — which is closed by default and not in the user's focus.

### Solution
Added a `ChatUploadCard` component that renders in the chat message timeline when a file is being uploaded.

**New state type:**
```ts
export type ChatUploadFeedback = {
  state: "uploading" | "processing" | "error";
  fileName: string;
  errorMessage?: string;
};
```

**States and messages:**
| State | Hebrew message | Icon |
|-------|---------------|------|
| `uploading` | מעלה את "[filename]"... | 📎 |
| `processing` | מכין את הקובץ לעבודה... | ⚙ |
| `error` | ההעלאה נכשלה + error detail | ⚠️ |

**Flow:**
1. User selects file in plus menu → `handleUploadWithFeedback` called
2. Immediately: card appears with `state: "uploading"`, `fileName`
3. After `onFileSelected` resolves (upload + metadata saved): card transitions to `state: "processing"`
4. After 6 seconds: card auto-dismisses (`setChatUploadFeedback(null)`)
5. On error: card shows `state: "error"` with message — stays until dismissed

**Honesty principle:** The card never says "Ready" or "Processing complete" — we don't fake knowledge of the real pipeline state. "מכין את הקובץ לעבודה..." is accurate (file is being prepared) without overclaiming.

**No backend changes.** The `handleUploadWithFeedback` wraps `onFileSelected` (which runs `handleFileSelected` in `page.tsx`). All existing upload pipeline behavior unchanged.

**New additions to TutorConversation.tsx:**
- `ChatUploadFeedback` type (exported)
- `chatUploadFeedback` state
- `uploadDismissTimerRef` for auto-dismiss
- `handleUploadWithFeedback` useCallback
- `ChatUploadCard` component (exported, with dismiss button)
- ChatUploadCard rendered in messages area (before typing indicator)
- `onUploadFile` in PlusMenu now receives `handleUploadWithFeedback` instead of `onFileSelected` directly

---

## 2. Menus

### Unified shadow and radius

All three menus now use consistent tokens:
- Shadow: `var(--tutor-menu-shadow)` = `0 4px 16px rgba(26,34,53,0.10), 0 1px 4px rgba(26,34,53,0.06)` (multi-layer, natural)
- Border-radius: `var(--tutor-radius-menu)` = `12px` (replaced `rounded-lg`/`rounded-xl` classes with CSS variable)
- No more `overflow-hidden` class on menu containers (the variable radius handles rounding)

**PlusMenu:** width increased from `w-56` to `w-60` (240px, more comfortable for mode names)

**ConversationMenu (WorkspaceSelector):** applied new shadow + radius tokens, increased top offset from `mt-0.5` to `mt-1`

**FileRowMenu (FilePanel):** applied new shadow + radius tokens, width from `min-w-[152px]` to `min-w-[156px]`, `mt-0.5` → `mt-1`

---

## 3. Design system tokens added

In `globals.css`:
```css
--tutor-menu-shadow: 0 4px 16px rgba(26,34,53,0.10), 0 1px 4px rgba(26,34,53,0.06);
--tutor-card-shadow: 0 2px 12px rgba(26,34,53,0.07);
--tutor-radius-menu: 12px;
--tutor-radius-card: 16px;
```

Refined existing shadows (slightly softer):
```css
--tutor-shadow-sm: 0 1px 2px rgba(26,34,53,0.06);  /* was 0.08 */
--tutor-shadow: 0 2px 8px rgba(26,34,53,0.10);      /* was 0.12 */
```

---

## 4. Sidebar polish

**CourseNavItem:**
- Padding increased to `8px 10px` (was `7px 10px`) — slightly more comfortable
- Font-weight for active: `600` (was `500`) — stronger active indicator
- Letter-spacing when active: `-0.01em` — tighter, more elegant
- Gap between icon and label: `gap-2.5` (was `gap-2`) — slightly more breathing room
- Icon wrapper: removed `opacity: 0.8` — folder icon is now fully visible

**Sessions container (branch connector):**
- Left margin: `marginLeft: 20px` (was `ml-3` = 12px) — more visual indent
- Padding left: `6px` (was `8px`) — slightly tighter against the line
- Added `mb-1` — small bottom margin after the sessions block

**SessionNavItem:**
- Padding: `5px 8px` (was `4px 8px`) — slightly taller rows
- Font-size: `12px` (was `11.5px`) — improved legibility

---

## 5. Composer polish

**Plus button:**
- Background when closed: `var(--tutor-surface)` (white) instead of `var(--tutor-border-subtle)` — cleaner, matches the textarea
- Added `boxShadow: var(--tutor-shadow-sm)` — consistent with textarea
- Removed unnecessary `onMouseDown={(e) => e.stopPropagation()}` from plus button (container ref handles close-on-outside)

**Textarea:**
- Replaced `rounded-2xl px-5 py-3.5` with explicit `borderRadius: 14px` and `padding: "14px 20px"` — same visual result but more intentional
- Added `lineHeight: 1.55` — slightly more comfortable for multi-line input

---

## 6. FilePanel polish

- `FileRowMenu` shadow and radius updated (see Menus section)
- No other FilePanel changes — it was already clean from previous batches
- Debug status codes remain absent (verified)

---

## 7. Sources

No changes. Sources already show `Source 1`, `Source 2` ordinals from the previous pass. Raw `fileId:chunkId` strings no longer appear as source labels. `originalFileName` is used when available from server.

---

## 8. Files changed

| File | Changes |
|------|---------|
| `src/app/globals.css` | Added `--tutor-menu-shadow`, `--tutor-card-shadow`, `--tutor-radius-menu`, `--tutor-radius-card`; softened `--tutor-shadow-sm` and `--tutor-shadow` |
| `src/components/tutor/TutorConversation.tsx` | Added `ChatUploadFeedback` type; `chatUploadFeedback` state; `uploadDismissTimerRef`; `handleUploadWithFeedback` callback; `ChatUploadCard` component (exported); chat card in messages area; plus button polish; textarea polish; PlusMenu shadow/width update |
| `src/components/workspaces/WorkspaceSelector.tsx` | `CourseNavItem` padding/weight polish; `SessionNavItem` size polish; sessions container margin/indent; `ConversationMenu` shadow + radius tokens |
| `src/components/files/FilePanel.tsx` | `FileRowMenu` shadow + radius tokens |
| `tests/components/tutor/TutorConversation.test.tsx` | Added `ChatUploadCard` import; 7 new `ChatUploadCard` tests |

---

## 9. Tests

**New: `ChatUploadCard` describe block (7 tests)**
- Renders with `uploading` state, correct `data-testid`, filename visible
- Uploading message is in Hebrew, contains filename
- Renders with `processing` state, Hebrew message
- Renders with `error` state, error message visible
- Renders dismiss button when `onDismiss` provided
- No dismiss button when `onDismiss` not provided
- Does not expose raw extraction/chunking/embedding status codes

**Totals:** 1006 tests pass (was 999). All existing tests pass.

---

## 10. Validation

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ passed |
| `npx vitest run` | ✅ 76 files passed, 1006 tests (+7 new), 121 skipped |
| `npm run build` | ✅ passed |
| `git diff --check` | ✅ passed |
| `graphify update .` | ✅ updated |

---

## 11. Deferred

| Item | Reason |
|------|--------|
| Real processing "done" signal in chat | Requires `page.tsx` to pass processing-complete event down to TutorConversation. The `uploadDismissTimerRef` currently uses a 6s heuristic. A proper solution would poll `fileProcessingStatusById` and dismiss when "Ready for learning". Deferred — current heuristic is safe and honest. |
| Animated spinner in ChatUploadCard | Static emoji icons used for now. A CSS spinner would be more polished but adds complexity. |
| Full ThemePicker migration out of sidebar | Still appears in both sidebar and /settings. Decide in next UX pass. |
| `--tutor-radius-card` applied to message bubbles | Cards still use `rounded-2xl` class. Could be unified via CSS var. Deferred. |
| PlusMenu Mode submenu animation | Expanding mode list has no transition animation. A `max-height` CSS animation could be added. |

---

## 12. Ready for Nevo manual UI smoke?

**YES**

### What to test
1. Upload a file from the plus menu → verify card appears in chat ("מעלה את...") → transitions to "מכין את הקובץ לעבודה..." → auto-dismisses after ~6s
2. Upload a file when no session selected → plus button should be disabled (test the guard)
3. Check that Work Mode and Cost Mode still work from plus menu
4. Verify sidebar: course has folder icon, sessions nested with branch line, active course is bolder
5. Check that file three-dot menu works with new shadow/radius
6. Check that conversation three-dot menu works with new shadow/radius
7. Navigate to /settings — still works
8. Send a message — still works, no regression

---

## 13. Safety confirmations

- I did not change tutor reasoning.
- I did not change retrieval logic.
- I did not change Deep PDF behavior.
- I did not change upload/extract/chunk backend behavior.
- I did not change soft delete semantics.
- I did not implement primaryFileId/attachedFileIds.
- I did not implement learner memory.
- I did not run `git add`.
- I did not commit.
- I did not push.
- I did not run `git pull`.

---

*Report created: 2026-06-03*
*Key addition: `ChatUploadCard` — honest, ephemeral upload feedback in chat timeline*
