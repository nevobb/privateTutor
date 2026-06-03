# UI/UX Batch 10B — Sidebar Three-dot Menu

## 1. Branch and HEAD
- **Branch:** `repair/workspace-cleanup-fit-check`
- **HEAD before batch:** `646a628 docs: add UI UX fit check and design direction`

---

## 2. Implementation

### Approach

Replaced the hover-reveal ✎/✕ button pair on each conversation row with a single three-dot (`⋯`) button that opens a compact dropdown menu. The dropdown contains "Rename" and "Delete" menu items. Existing rename and delete flows (inline form, Hebrew confirmation) are unchanged — only the trigger mechanism changed.

### New state added

```ts
const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
```

### Close-on-outside behavior

A `useEffect` registers document-level `mousedown` and `keydown` listeners whenever a menu is open. On any click outside the menu, or on `Escape`, the menu closes. The menu container and trigger button stop mousedown propagation to prevent self-closing.

```ts
useEffect(() => {
  if (!openMenuSessionId) return;
  const handleMouseDown = () => setOpenMenuSessionId(null);
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") setOpenMenuSessionId(null);
  };
  document.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("keydown", handleKeyDown);
  return () => {
    document.removeEventListener("mousedown", handleMouseDown);
    document.removeEventListener("keydown", handleKeyDown);
  };
}, [openMenuSessionId]);
```

### Session row structure

Old:
```
<li class="group flex items-center gap-0.5">
  <NavItem />
  <span opacity-0 group-hover:opacity-100>
    <button>✎</button>
    <button>✕</button>
  </span>
</li>
```

New:
```
<li class="group relative flex items-center">
  <NavItem />
  <div class="flex-shrink-0 relative pr-1">          ← relative anchor for dropdown
    <button aria-haspopup aria-expanded ...>          ← three-dot trigger
      <ThreeDots />
    </button>
    {isMenuOpen && <ConversationMenu ... />}           ← absolute dropdown
  </div>
</li>
```

The three-dot button uses `opacity-0 group-hover:opacity-100` when the menu is closed, and `opacity-100` (explicit class) when the menu is open — ensuring the button stays visible while its menu is open even after the cursor moves away.

### ConversationMenu component

Exported as a named export for testability. Positioned `absolute right-0 top-full mt-0.5 z-50`. Uses `role="menu"` on the container, `role="menuitem"` on each item.

```
┌────────────────────────────────┐
│ ✎  Rename                      │
│ 🗑  Delete    (red)             │
└────────────────────────────────┘
```

- Rename item: uses sidebar text color
- Delete item: uses `#c0392b` (same red as existing delete confirmation button)
- Both items have hover background transitions

---

## 3. Files changed

**Modified:**
- `src/components/workspaces/WorkspaceSelector.tsx`
  - Added `useEffect` import
  - Added `openMenuSessionId` state
  - Added `useEffect` for document close listeners
  - Added `hasMenuActions` computed boolean
  - Changed session row `<li>` class to include `relative`
  - Replaced two hover-reveal buttons with single three-dot button + `ConversationMenu`
  - Added `ThreeDots` SVG component (file-private)
  - Added `ConversationMenu` component (exported)
  - Added `RenameIcon` SVG component (file-private)
  - Added `DeleteIcon` SVG component (file-private)
  - `NavItem` and `NewAction` unchanged

**New:**
- `tests/components/workspaces/WorkspaceSelector.test.tsx` (21 tests)

---

## 4. Conversation menu behavior

| User action | Result |
|-------------|--------|
| Hover over conversation row | Three-dot button fades in |
| Click three-dot button | Menu opens for that session |
| Click same button again | Menu closes (toggle) |
| Click outside menu | Menu closes (document mousedown) |
| Press Escape | Menu closes (document keydown) |
| Click "Rename" | Menu closes, rename inline form opens |
| Click "Delete" | Menu closes, Hebrew delete confirmation opens |

---

## 5. Rename behavior

Unchanged from Batch 9B:
- Inline form replaces the session row
- Input pre-filled with current title, maxLength=120
- Save/Cancel buttons
- Calls existing `onRenameSession` prop
- Error shown inline if API fails
- Cancel restores normal row

The only change: rename mode is now **entered via menu item click** instead of ✎ hover button.

---

## 6. Delete behavior

Unchanged from Batch 9C:
- Hebrew inline confirmation replaces the session row: `מחק "{label}"?`
- Red `מחק` button / `ביטול` cancel button
- Calls existing `onDeleteSession` prop
- Soft delete only — no hard delete
- Error shown inline if API fails
- Cancel restores normal row

The only change: delete confirmation is now **entered via menu item click** instead of ✕ hover button.

---

## 7. Visual / accessibility notes

- Three-dot button: `aria-haspopup="true"`, `aria-expanded={isMenuOpen}`, `aria-label="Conversation options: {title}"`
- Menu container: `role="menu"`, `aria-label="Conversation options"`
- Menu items: `role="menuitem"`, `type="button"`
- Three-dot trigger uses `data-testid="conversation-menu-trigger"` for test targeting
- Menu uses `data-testid="conversation-menu"` for test targeting
- Menu never renders when both `onRenameSession` and `onDeleteSession` are undefined
- Active session styling (`tutor-sidebar-active` background, `tutor-accent` left border) is fully preserved — the three-dot button sits outside the `NavItem` button's click area
- Rename icon: minimal pencil SVG (`11×11`)
- Delete icon: minimal trash SVG (`11×11`)
- Three-dots: horizontal dots SVG (`12×12`)

---

## 8. Tests

### New: `tests/components/workspaces/WorkspaceSelector.test.tsx` (21 tests)

**Conversation menu trigger:**
- Renders three-dot button per session when rename/delete handlers provided
- Three-dot button has `aria-haspopup`
- Three-dot button has `aria-label` referencing session title
- No three-dot button when neither handler provided
- Three-dot button present when only rename provided
- Three-dot button present when only delete provided

**Session list:**
- Renders session titles
- Active session has `tutor-sidebar-active` background + `tutor-accent` border
- Inactive sessions have `transparent` background and `font-weight:400`
- Empty title falls back to "Conversation N"
- Empty session list shows "No conversations"
- "+ New conversation" button always rendered

**ConversationMenu:**
- Renders both Rename and Delete when both handlers provided
- Renders only Rename when onDelete not provided
- Renders only Delete when onRename not provided
- Container has `role="menu"`
- Items have `role="menuitem"` (×2)
- Renders nothing when neither handler provided

**Topic list:**
- Renders topic names
- Shows loading state
- Shows error state

---

## 9. Validation

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ passed |
| `npx vitest run` | ✅ 76 files passed, 18 skipped; 968 tests passed (+21 new), 121 skipped |
| `npm run build` | ✅ passed |
| `git diff --check` | ✅ passed |
| `graphify update .` | ✅ 4663 nodes, 6352 edges, 314 communities |

---

## 10. Not changed

- No backend behavior changed
- No session rename API changed
- No session delete API changed
- No tutor behavior changed
- No retrieval changed
- No Deep PDF behavior changed
- No file upload/delete behavior changed
- No Settings implemented
- No composer plus menu implemented
- No chat layout changed
- `NavItem` component: unchanged
- `NewAction` component: unchanged
- Rename inline flow: unchanged (same form, same validation)
- Delete confirmation flow: unchanged (same Hebrew confirm, same API call)
- `page.tsx`: not touched (all handlers already exist and are passed as props)

---

## 11. Risks / open decisions

| Topic | Note |
|-------|------|
| Dropdown clipping | Menu uses `position: absolute` inside `overflow-y: auto` sidebar scroll container. If a session row is at the very bottom of the visible scroll area, the dropdown may be clipped vertically. Acceptable for MVP — add Portal/fixed positioning if this becomes a real problem. |
| Mobile | Hover-reveal pattern works for desktop. On mobile, the three-dot button is always opacity-0 without hover. A future batch (10H) should ensure the button is always visible at a lower opacity on touch devices. |
| Keyboard navigation within menu | Tab moves focus to the next interactive element; Arrow keys do not navigate menu items. Full WAI-ARIA menuitem keyboard navigation (Arrow Up/Down, Home/End) is deferred. Current implementation is accessible via Tab + Enter. |
| `useEffect` document listener | The listener is added/removed cleanly. No memory leak risk. Pattern is standard for this use case. |

---

## 12. Ready for Batch 10C?

**YES**

Batch 10C (composer plus menu + file upload entry point, Work/Cost Mode out of toolbar) is the next logical step. It involves `TutorConversation.tsx` and possibly `page.tsx`. No dependency on 10B beyond the general approach being established.

---

## 13. Safety confirmations

- I did not change backend behavior.
- I did not change rename/delete APIs.
- I did not change tutor behavior.
- I did not change retrieval.
- I did not change Deep PDF behavior.
- I did not change file upload/delete behavior.
- I did not implement composer plus menu.
- I did not implement Settings.
- I did not run `git add`.
- I did not commit.
- I did not push.
- I did not run `git pull`.

---

*Report created: 2026-06-03*
*Next batch: 10C — Composer plus menu + file upload entry point*
