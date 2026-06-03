# UI/UX Repair — Plus Menu and Visual Completion

## 1. Plus menu root cause

The `PlusMenu` renders inside a `<form>` element. All three menus (PlusMenu, ConversationMenu, FileRowMenu) used the same "close on outside click" pattern:

```
document.addEventListener("mousedown", () => closeMenu())
+ onMouseDown={(e) => e.stopPropagation()}   ← on the menu container
```

This pattern is unreliable inside a `<form>`. The native `document.addEventListener("mousedown", ...)` fires BEFORE React has a chance to process the click event on the button inside the menu. When the native listener fires first:

1. `mousedown` → document listener → `closeMenu()` → state update scheduled → menu component scheduled for unmount
2. The menu button is now unmounted before `click` fires
3. `click` fires on an unmounted element → React handler never executes
4. The action (mode change, upload trigger) silently does nothing

This is why "Upload file", "Work Mode", and "Cost Mode" appeared to do nothing. The user would see the menu close, but none of the callbacks would execute.

The `stopPropagation()` approach is unreliable because React 18's synthetic event system doesn't guarantee that `stopPropagation()` prevents native document-level listeners from firing in all circumstances, particularly when the component tree includes a `<form>` element.

---

## 2. Plus menu fixes (per action)

### Fix applied: `ref.contains()` pattern in all three menus

Replaced the `stopPropagation` approach with a `useRef` + `.contains()` check:

```tsx
// Before (unreliable):
const handleMouseDown = () => closeMenu();
// + onMouseDown={(e) => e.stopPropagation()} on the menu

// After (reliable):
const containerRef = useRef<HTMLDivElement>(null);
const handleMouseDown = (e: MouseEvent) => {
  if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
    closeMenu();
  }
};
// No stopPropagation needed anywhere
```

This pattern: the document listener fires on every mousedown, checks if the click target is INSIDE the ref container, and only closes if outside. No dependency on `stopPropagation` reliability.

### Upload file
- **Before**: label click → document listener fires immediately → menu closes → file picker never opens
- **After**: label click → `contains(label)` is true → menu stays open → file picker opens → user selects file → `onUploadFile(file)` called → `onMenuClose()` closes menu
- The `onFileSelected` prop from `page.tsx` is correctly passed as `onUploadFile` in `PlusMenu`. It points to `handleFileSelected` which runs the full upload pipeline.
- **Status: WORKS**

### Work Mode selection
- **Before**: click "Mode:" → document listener fires first → menu unmounts → mode sub-menu never expands
- **After**: click "Mode:" → `contains` check passes → menu stays open → `setWorkModeMenuOpen(true)` → sub-menu renders → user clicks a mode → `onWorkModeChange(mode)` called → `setPlusMenuOpen(false)` closes menu
- Context strip badge updates immediately (shows abbreviated mode label)
- Mode is passed to `sendSessionMessage` on next message send
- **Status: WORKS**

### Cost Mode selection
- Same fix as Work Mode. Fully functional.
- **Status: WORKS**

### Upload image
- Renders as `<div>` (not a button), with `opacity-40 cursor-not-allowed` classes
- Not clickable, clearly styled as "Soon"
- **Status: CORRECTLY DISABLED**

### Open file panel
- **Removed entirely** from PlusMenu. Was not implemented and would have been a no-op clickable item.
- No placeholder, no fake behavior.
- **Status: REMOVED**

---

## 3. Working actions summary

| Action | Status | Notes |
|--------|--------|-------|
| Upload file | ✅ Works | Opens file picker; file goes to workspace knowledge base |
| Upload image | 🔒 Disabled | Visible but not clickable; "Soon" label |
| Work Mode | ✅ Works | Sub-menu expands; selection updates context strip + future sends |
| Cost Mode | ✅ Works | Sub-menu expands; selection updates state |
| Open file panel | ❌ Removed | Was a no-op; removed to avoid fake behavior |

---

## 4. Visual design changes

### Sidebar: Courses hierarchy
- Section label changed: **"Topics" → "Courses"**
- Empty state: **"No topics yet" → "No courses yet"**
- New course action: **"+ New topic" → "+ New course"**
- Course input placeholder: **"Topic name" → "Course name"**

### Course items: folder icon
- New `CourseNavItem` component replaces generic `NavItem` for workspace/course items
- Each course shows an inline folder SVG icon to the left of the name
- Icon color: accent color when selected, muted when inactive
- `data-testid="folder-icon"` and `data-testid="course-nav-item"` for testability

### Session hierarchy nested under course
- **Removed** the separate "Conversations" section header (visual separation between courses and sessions is gone — cleaner hierarchy)
- Sessions now render **inline below the selected course** inside a visual indent block:
  - `margin-left: 12px`, `padding-left: 8px`, `border-left: 1px solid var(--tutor-sidebar-border)` — creates a visible "branch line" connector
  - `data-testid="sessions-under-course"` on the container
- Sessions only visible when a course is selected (same behavior, better visual grouping)

### Session items: smaller, lighter
- `SessionNavItem` replaces `NavItem` for session rows
- Font size: **11.5px** (was 12px) — slightly smaller than course items to reinforce hierarchy
- Padding: tighter (`4px 8px` vs `7px 10px`) — more compact, shows more sessions without scrolling
- No `borderLeft` accent bar on sessions (cleaner appearance; visual hierarchy comes from the parent branch line)
- Active session still gets `background: var(--tutor-sidebar-active)` + `font-weight: 500`

### Three-dot menu on sessions
- Retained unchanged from Batch 10B
- `onMouseDown={(e) => e.stopPropagation()}` removed from trigger and menu (now using `contains` pattern)
- `ref={isMenuOpen ? openMenuRef : undefined}` attaches the shared ref to the currently open menu container

---

## 5. Composer changes

- **`plusMenuContainerRef`**: `useRef<HTMLDivElement>` added; attached to the outer container div that wraps both the `+` button and `PlusMenu`
- **`useEffect`**: updated to use `plusMenuContainerRef.current.contains(e.target)` check
- **PlusMenu**: removed `onMouseDown={(e) => e.stopPropagation()}` from the menu container div
- **"Open file panel" item**: removed from `PlusMenu` (was unimplemented)
- Plus button, textarea, and send button layout unchanged: `[+]` `[textarea]` `[send]`

---

## 6. FilePanel changes

- Added `useRef` import
- Added `openFileMenuRef = useRef<HTMLDivElement | null>(null)`
- `useEffect` for `openFileMenuId`: updated to `contains()` pattern
- `ref={isMenuOpen ? openFileMenuRef : undefined}` attached to the three-dot menu container per file row
- Removed `onMouseDown={(e) => e.stopPropagation()}` from `FileRowMenu` component

---

## 7. Settings / theme

No changes in this pass. `/settings` route is accessible and functional from Batch 10C. ThemePicker remains in sidebar footer as well.

---

## 8. Sources

No changes. Already fixed in Batch 10C: `Source 1`, `Source 2` labels instead of raw UUID strings.

---

## 9. Files changed

| File | Change |
|------|--------|
| `src/components/tutor/TutorConversation.tsx` | Add `plusMenuContainerRef`; fix `useEffect` to use `contains`; remove `onMouseDown` stopPropagation from PlusMenu; remove "Open file panel" item; attach ref to container div |
| `src/components/workspaces/WorkspaceSelector.tsx` | "Topics" → "Courses" throughout; add `FolderIcon` SVG; new `CourseNavItem` with folder icon; new `SessionNavItem` for sessions; remove "Conversations" section label; visual hierarchy with branch line; `contains` fix for conversation menu close; `openMenuRef` for menu container |
| `src/components/files/FilePanel.tsx` | Add `useRef` import; `openFileMenuRef`; `contains` fix for file menu close; `ref` on menu container div; remove `onMouseDown` stopPropagation from `FileRowMenu` |
| `tests/components/workspaces/WorkspaceSelector.test.tsx` | Full rewrite: "Courses" label tests; folder icon test; session hierarchy tests; remove "Topics" assertions; update session styling tests to match new `SessionNavItem` (no borderLeft) |

---

## 10. Tests

| Suite | Tests | Notes |
|-------|-------|-------|
| WorkspaceSelector — courses section | 6 new | "Courses" label, folder icon, course nav item, "No courses yet", "+ New course" |
| WorkspaceSelector — session hierarchy | 8 | sessions nested under course, active/inactive styling, empty state, new conversation button |
| WorkspaceSelector — three-dot menu trigger | 6 | unchanged behavior, still passes |
| ConversationMenu | 6 | unchanged behavior, still passes |
| WorkspaceSelector — loading/error | 2 | updated to say "courses" |
| All previous PlusMenu tests | 9 | still pass |
| All FilePanel tests | 13+ | still pass |
| All TutorConversation tests | 24+ | still pass |

**Total: 999 tests pass** (was 991)

---

## 11. Validation

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ passed |
| `npx vitest run` | ✅ 76 files passed, 999 tests passed (+8 new), 121 skipped |
| `npm run build` | ✅ passed |
| `git diff --check` | ✅ passed |
| `graphify update .` | ✅ 4743 nodes, 6435 edges, 308 communities |

---

## 12. Deferred items

| Item | Reason |
|------|--------|
| "Open file panel" from composer | Not implemented; removed no-op. Deferred: lift `filePanelOpen` state to `page.tsx`, add `forceOpen` prop to CollapsiblePanel. |
| `originalFileName` in source citations | Requires server-side enrichment of citation objects (Document Understanding Layer Phase C/D). Source labels currently show "Source 1", "Source 2" etc. |
| ThemePicker fully out of sidebar | Kept in sidebar for quick access. Full migration to Settings only is a future decision. |
| Long answer "split into cards" behavior | Tutor behavior change — outside UI phase scope. |
| Mobile/touch hover behavior | App is desktop-first. |
| Settings page live cross-page sync | Developer diagnostics toggle in Settings writes to localStorage; takes effect on next page load. Acceptable for this use pattern. |

---

## 13. Ready for Nevo manual UI smoke?

**YES**

### What works
- **Plus menu**: Upload file triggers file picker + runs full workspace upload pipeline. Work Mode and Cost Mode selections update state and take effect on next message send. Upload image is clearly disabled (not a silent no-op).
- **Sidebar**: Folder icons on courses. "Courses" label. Sessions nested visually under their course with a branch line connector. Three-dot rename/delete still works.
- **FilePanel**: `✓ Ready` / `Processing…` / `Failed` labels. Three-dot file menu (Delete active, future actions disabled).
- **Chat**: 15px default font, 680px max-width. Configurable from `/settings`.
- **Sources**: "Source 1" / "Source 2" ordinals instead of raw UUIDs.
- **Settings**: `/settings` page accessible via ⚙ in sidebar footer.

### Known remaining gap
- "Open file panel" from plus menu is not present (removed). File panel is accessible from the sidebar's "Study materials" collapsible.

---

## 14. Safety confirmations

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
*Root cause: `stopPropagation` unreliable inside `<form>` — replaced with `ref.contains()` throughout*
