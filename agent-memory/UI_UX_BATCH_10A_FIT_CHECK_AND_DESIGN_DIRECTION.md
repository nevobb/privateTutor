# UI/UX Batch 10A — Fit Check and Design Direction

---

## 1. Branch and HEAD commit

- **Branch:** `repair/workspace-cleanup-fit-check`
- **HEAD:** `19c880a docs: add deleted file exclusion audit`

---

## 2. Current UI structure

### Layout (from MainLayout.tsx + page.tsx)

```
Screen
├── Left sidebar (296px, collapsible to 48px rail)
│   ├── App header: "Private Tutor" + Sign out + user avatar/email block
│   ├── WorkspaceSelector
│   │   ├── "Topics" section label
│   │   ├── Topic list (workspace items, click to select)
│   │   ├── + New topic
│   │   ├── "Conversations" section label (only when a topic is selected)
│   │   ├── Conversation list (sessions for selected workspace)
│   │   │   └── Hover reveals: ✎ rename button + ✕ delete button
│   │   └── + New conversation
│   ├── CollapsiblePanel "Study materials" (defaultOpen: false)
│   │   └── FilePanel
│   │       ├── Upload button (label with file input)
│   │       └── File rows: icon, name, date, E:/C:/Emb: status codes, Continue/Retry/Ready
│   ├── CollapsiblePanel "Tutor memory" (defaultOpen: false)
│   │   └── MemoryPanel
│   ├── ThemePicker button → modal (color presets + fine-tuning)
│   └── Developer diagnostics toggle
│
└── Main area (flex-1)
    └── TutorConversation
        ├── Toolbar bar (always visible): WorkModeSelector | CostModeSelector
        ├── Context strip: "Topic: X · Mode: Y · Sources: N files available"
        ├── Message area (scrollable)
        │   └── MessageBubble per message
        │       └── SourcesSection <details> dropdown if citations exist
        ├── Diagnostics panel (only if dev diagnostics enabled)
        └── Input bar: [Send button] [Textarea]
```

### What is always visible
- Sidebar: app name, user info, topic list
- Main toolbar: WorkModeSelector + CostModeSelector (full selectors)
- Context strip: topic/mode/sources text line
- Input bar: send button + textarea

### What is hidden
- Conversations: only visible when a topic (workspace) is selected
- Study materials panel: collapsed by default
- Tutor memory panel: collapsed by default
- ThemePicker: opens as modal on click
- Diagnostics panel: only when developer mode is enabled

### What feels misplaced
- WorkMode + CostMode selectors always in toolbar — Nevo uses them rarely
- ThemePicker in sidebar footer — belongs in Settings
- Developer diagnostics toggle in sidebar — belongs in Settings
- MemoryPanel in sidebar — rarely used in daily work, adds visual clutter
- Upload button inside sidebar collapsible panel — should be in composer
- Context strip repeats info visible from sidebar (topic) + info being moved out of toolbar (mode)
- File status rows show `E:completed C:completed Emb:completed` debug codes, not user-friendly labels

---

## 3. Current placement problems

| Problem | Current | Impact |
|---------|---------|--------|
| WorkMode/CostMode always visible | Toolbar top of chat | Wastes space; rarely changed |
| Rename/delete as hover-reveal buttons | Per-conversation hover icons (✎/✕) | Not discoverable; inconsistent with three-dot pattern |
| File upload in sidebar panel | CollapsiblePanel "Study materials" | Disconnects upload from conversation context |
| File status as debug codes | `E:completed C:completed Emb:completed` | Confusing for user; should be "Ready ✓" or "Processing..." |
| Sources dropdown shows raw IDs | `fileId • chunkId` format | Illegible; no filename, no page, no quote quality |
| ThemePicker in sidebar footer | Permanent sidebar button | Should be in Settings, not daily navigation |
| Developer diagnostics toggle in sidebar | Sidebar footer | Not a daily-use control; belongs in Settings |
| MemoryPanel in sidebar | Always-available collapsible | Rarely needed during daily tutor session |
| No font size control | Not implemented | Long Hebrew/math answers strain readability |
| Chat width hardcoded at 72% | `max-w-[72%]` in MessageBubble | Cannot be adjusted; may be too narrow at some viewport sizes |
| No plus menu in composer | Not implemented | Upload, mode changes have no clear entry point from chat |
| No settings screen | Not implemented | Display preferences have nowhere to live except sidebar clutter |

---

## 4. Locked design direction

Per Nevo's product decisions:

1. **Layout:** Left sidebar (courses + recent conversations per course) + main chat area dominant. No dashboard. No LMS feel. Calm and focused.
2. **Conversation model:** Grouped under courses. Actions (rename, delete) in three-dot menu.
3. **File model:** File panel closed by default. Upload from composer plus menu. File display: name + green checkmark when ready. File actions in three-dot menu.
4. **Composer:** Plus button with: upload file, upload image, change Work Mode, change Cost Mode, open file panel. Work Mode + Cost Mode hidden by default.
5. **Settings:** Separate screen for font size, chat/message width, color palette/theme, other display preferences.
6. **Chat readability:** Larger readable text, adjustable chat width. Long answers may need future tutor behavior (split into cards/steps).
7. **Sources:** Not useful in current format. Hide by default or redesign later with filename + page + quote + relevance.
8. **Visual direction:** Modern chat, Apple-like interaction quality. Default background: light beige / warm neutral. Palette configurable. No forced dark mode.

---

## 5. Target layout (post-redesign)

```
Screen
├── Left sidebar (collapsible)
│   ├── App header: "Private Tutor" + user avatar
│   ├── Course list (workspaces)
│   │   └── Under each course: recent conversations
│   │       └── Each conversation: click to open, ⋯ three-dot menu
│   │           └── Menu: Rename, Delete (more actions later)
│   └── Footer: gear icon → Settings
│
└── Main area
    └── TutorConversation
        ├── Minimal top bar: session title (optional)
        ├── Message area (scrollable, centered, configurable max-width)
        │   └── MessageBubble
        │       └── Sources: hidden by default or "N sources" badge only
        ├── (Composer)
        │   ├── [+] button → popover menu:
        │   │   ├── Upload file
        │   │   ├── Upload image (future)
        │   │   ├── Work Mode (picker, current selection shown)
        │   │   ├── Cost Mode (picker, current selection shown)
        │   │   └── Open file panel
        │   ├── Textarea (larger, wider min-height)
        │   └── [Send] button
        └── File panel (slide-in or overlay, hidden by default)
            └── File rows: name + ready checkmark OR processing spinner
                └── ⋯ three-dot menu: delete, summarize (future), ask about (future)
```

---

## 6. Feature placement table

| Feature | Current | Target location |
|---------|---------|-----------------|
| Course list | Sidebar "Topics" | Sidebar top |
| Conversation list | Sidebar "Conversations" (below topic) | Sidebar, nested under each course |
| Rename conversation | Hover ✎ button | Three-dot menu on conversation row |
| Delete conversation | Hover ✕ button | Three-dot menu on conversation row |
| File list | Sidebar "Study materials" collapsible | Closed-by-default panel, opened from plus menu |
| Upload file | File panel upload label | Plus menu in composer |
| Delete file | File panel row button | Three-dot menu on file row |
| Summarize file | Not implemented | Three-dot menu on file row (future) |
| Ask about file | Not implemented | Three-dot menu on file row (future) |
| Start learning from file | Not implemented | Three-dot menu on file row (future) |
| Work Mode | Always-visible toolbar | Plus menu in composer (collapsed by default) |
| Cost Mode | Always-visible toolbar | Plus menu in composer (collapsed by default) |
| Upload image | Not implemented | Plus menu in composer (future) |
| Sources | Inline `<details>` dropdown, raw IDs | Hide by default; redesign later with filename + page |
| Font size | Not implemented | Settings screen |
| Chat width | Hardcoded 72% | Settings screen (CSS variable `--tutor-chat-max-width`) |
| Color palette / theme | Sidebar footer ThemePicker | Settings screen |
| Developer diagnostics | Sidebar toggle | Settings screen |
| Tutor memory | Sidebar collapsible | Settings or separate debug screen |

---

## 7. Composer / plus menu recommendation

### Current state
- Only a textarea + send button (no plus button)
- Upload lives in sidebar `FilePanel` inside `CollapsiblePanel "Study materials"`
- WorkMode/CostMode in toolbar are `WorkModeSelector` + `CostModeSelector` components

### Recommended plus menu implementation

```
[+] button → floating popover (above input, positioned left)
  ┌────────────────────────────────┐
  │  📎 Upload file                │
  │  🖼️  Upload image (coming soon) │
  │  ─────────────────────────     │
  │  Mode: Learning ▸              │  (shows current workMode, click to change)
  │  Cost: Normal Learning ▸       │  (shows current costMode, click to change)
  │  ─────────────────────────     │
  │  📂 Open file panel            │
  └────────────────────────────────┘
```

### Implementation notes

- `workMode` + `costMode` state stays in `page.tsx` — only display moves
- The plus menu popover contains mode selectors (sub-menu or inline picker)
- Upload file: triggers existing `handleFileSelected` flow via `page.tsx` prop
- "Open file panel": toggles a panel state (new local state in TutorConversation or page)
- WorkMode/CostMode toolbar can be removed or replaced with a minimal context line
- Context strip can be simplified or removed (topic name is visible in sidebar)

---

## 8. File upload from chat — data model implications

### Requirement
A file uploaded from the chat composer becomes:
a. The main context of the current conversation
b. Part of the course knowledge base

### Current data model state

`SessionRecord` (from `workspaceTypes.ts`) has NO file attachment fields:
```ts
// Absent:
primaryFileId?: string
attachedFileIds?: string[]
```

`UploadedFile` only has `workspaceId` — no session link.

Current retrieval behavior (in `fileChunkRetrievalService.ts`): retrieves from ALL workspace files, not session-specific. This satisfies requirement (b) automatically. Requirement (a) is not satisfied.

`TUTOR_FILE_BEHAVIOR_MATRIX.md` documents this as a planned future extension:
> "Session-attached files: when a file is attached to a specific conversation, prioritize its chunks in inventory + retrieval."

### Is there already a conversation-file attachment model?
**No.** Not implemented. Files are workspace-scoped only.

### Is there a primaryFileId / attachedFileIds concept?
**No.** Not in current `SessionRecord`.

### Minimal data model needed (implement LATER, after visual cleanup)

```ts
// Add to SessionRecord in workspaceTypes.ts
primaryFileId?: string | null;     // The "main" file for this conversation
attachedFileIds?: string[];        // All files attached during this conversation
```

Or a subcollection (more flexible but heavier):
```
users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}/attachedFiles/{fileId}
```

The field approach is simpler and sufficient for MVP.

### Files that would need changes (DEFERRED)

| File | Change needed |
|------|--------------|
| `src/server/workspaces/workspaceTypes.ts` | Add `primaryFileId?`, `attachedFileIds?` to `SessionRecord` |
| `src/server/workspaces/sessionRepository.ts` | Read/write new fields |
| `src/server/workspaces/sessionApiService.ts` | Expose `setPrimaryFile` operation |
| `src/server/workspaces/fileChunkRetrievalService.ts` | When `primaryFileId` set, boost or filter to that file's chunks |
| `src/server/workspaces/sessionMessageApiService.ts` | Pass `primaryFileId` context to retrieval + inventory |
| `src/server/tutor/requestClassifier.ts` | `ambiguous_file_reference`: resolve to `primaryFileId` first |
| `src/components/tutor/TutorConversation.tsx` | On upload from composer, call `setPrimaryFile` with new fileId |

### What to defer until after visual cleanup
Everything above. The upload-from-chat UX can land in Batch 10C (just routes to existing `handleFileSelected`) without any data model changes. The "becomes primary context" behavior is deferred to a future batch after visual cleanup is complete.

---

## 9. Settings screen recommendation

### What belongs in Settings (not daily chat surface)

| Setting | Current home | Settings location |
|---------|-------------|-------------------|
| Font size | Not implemented | Display → Font size (steps: Small/Medium/Large or slider) |
| Chat message width | Hardcoded 72% | Display → Chat width (CSS var `--tutor-chat-max-width`) |
| Color palette/theme | Sidebar ThemePicker | Appearance → Theme presets + fine-tuning colors |
| Developer diagnostics | Sidebar toggle | Advanced → Developer diagnostics toggle |
| Tutor memory panel | Sidebar collapsible | Keep accessible from sidebar OR move to Settings → Memory |

### Implementation approach

- New page: `src/app/settings/page.tsx` OR a full-screen overlay/modal accessible via gear icon in sidebar footer
- CSS variables approach:
  ```css
  --tutor-chat-font-size: 15px;    /* saved to localStorage */
  --tutor-chat-max-width: 640px;   /* saved to localStorage */
  ```
- Settings component reads from localStorage on mount, writes on change, applies to `:root`
- No backend needed for display preferences

### Where to put the Settings entry point
- Gear icon (⚙) in sidebar footer, below ThemePicker's current position
- Or: below user avatar in sidebar header

### What stays accessible from sidebar
- Quick preset color dots (or remove entirely and redirect to Settings)
- Possibly a one-tap theme toggle (light/dark or preset switcher) if needed for daily use

---

## 10. Chat readability recommendation

### Current state
- Body font: `Inter`, system-ui (globals.css)
- Tutor message font: `Lora`, Georgia serif (applied inline in MessageBubble)
- Base text size: `text-sm` = 14px (Tailwind default)
- Message bubble max-width: `max-w-[72%]` (% of chat area — not fixed)
- Chat padding: `px-6 py-6`, message spacing: `space-y-5`
- Input textarea: `text-sm`, `minHeight: 52px`
- No font-size control, no chat-width control

### Recommended changes (Batch 10E)

**Font size:**
- Increase tutor message text to 15px or 16px as default
- Add `--tutor-chat-font-size` CSS variable
- Apply to `.message-content` and `MessageBubble`
- Settings screen controls this variable

**Chat width:**
- Replace `max-w-[72%]` with a CSS variable: `--tutor-chat-max-width: 660px`
- Use `style={{ maxWidth: 'var(--tutor-chat-max-width)' }}` on message bubbles
- This gives a consistent fixed width regardless of sidebar state
- Settings screen exposes a width control (Narrow / Default / Wide steps, or pixel slider)

**Input bar:**
- Increase `minHeight` from 52px to 60px
- Consider `text-base` (16px) for the input textarea
- The input bar width should match or reference the same max-width variable

**Long answers:**
- Note: future tutor behavior (split into cards/steps) is deferred — not a UI phase concern
- For now: ensure readability by larger font + better width

---

## 11. Sources display recommendation

### Current state
- `SourcesSection` in `TutorConversation.tsx` renders a `<details>` dropdown: "Sources (N)"
- `formatSourceLabel` splits `sourceId` by `:` → shows `fileId • chunkId` (raw UUIDs)
- `referenceText` shown (the chunk text excerpt), clamped to 3 lines
- Not human-readable: no filename, no page number, no reason it was retrieved

### Design direction decision: hide by default

**Rationale:** Sources in current format add noise, not signal. Showing raw UUIDs undermines trust. Until source data includes original filename + page/section + why-it-matters metadata, sources should not surface.

**Recommended for Batch 10G:**
- Option A (simplest): Remove `SourcesSection` entirely until data is richer
- Option B: Replace with a minimal "📄 N sources" badge (no expansion, no content)
- Option C: Show only file display name (not chunkId), no quote, collapsed by default

**Prerequisite for full sources redesign:**
`Document Understanding Layer Phase C/D` — when `detectedQuestions` include `label`, `topic`, `pageStart`, and `sourceChunkIds`, the citation data can be enriched with filename + page + section. Only then does a full sources panel have useful content.

**Immediate recommendation (Batch 10G):** Option A or B. Remove or badge-only. Do not show raw IDs.

---

## 12. Theme / palette recommendation

### Current state
- 6 presets already exist: Navy, Sage, Blue, Warm, Slate, Rose
- All use warm neutral `--tutor-bg` (~`#F8F4EF` or similar) — matches Nevo's direction
- Default preset: Navy (dark sidebar, warm beige content area)
- Fine-tuning: Accent, Background, Sidebar, User msg (4 color controls)
- ThemePicker stored in sidebar footer; opens modal on click

### Assessment
- **Default background is already correct** — `#F8F4EF` (warm beige) is the default in `globals.css`
- **Palette switching already works** — ThemePicker + 6 presets are functional
- **No dark mode forced** — all presets are light-content with optional dark/light sidebar
- **Warm preset** (`warm`) has fully warm sidebar too — useful for Nevo's preference

### Recommendations (Batch 10H / Settings migration)

1. **Move ThemePicker to Settings screen** (Batch 10F) — keep sidebar clean
2. **Consider adding "Beige" as an explicit light-sidebar + beige-all variant** if Sage/Warm don't feel right
3. **Add `--tutor-surface-raised` to fine-tuning** — currently only 4 vars exposed; `--tutor-surface-raised` affects context strip and diagnostics backgrounds
4. **Do not add dark mode** in this phase — not requested, would require full color system audit

---

## 13. Recommended Batch 10 plan

### 10B — Sidebar information architecture
**Goal:** Courses/conversations hierarchy + three-dot menu for conversation actions
- Replace hover-reveal ✎/✕ with a `⋯` (three-dot) button per conversation row
- Three-dot menu: Rename, Delete (reuse existing handler logic)
- Visually clarify that conversations are grouped under their course (already is, just needs visual hierarchy)
- Optional: session title in sidebar should show topic-relative name
- **No backend changes.** UI-only.
- Files: `WorkspaceSelector.tsx`

### 10C — Composer plus menu + upload entry point
**Goal:** Plus button in composer; Work/Cost Mode moved out of always-visible toolbar
- Add `+` button to input bar (left of textarea)
- Plus popover: upload file, Work Mode picker, Cost Mode picker, open file panel
- Remove WorkModeSelector + CostModeSelector from always-visible toolbar
- Wire upload: `+` → file input → existing `handleFileSelected` flow (no backend change)
- Replace toolbar with minimal session context line OR remove entirely
- Files: `TutorConversation.tsx`, `page.tsx`; potentially remove/simplify toolbar components

### 10D — File panel simplification
**Goal:** File display clean-up; three-dot menu for file actions
- Replace `E:completed C:completed Emb:completed` with human-readable labels:
  - All complete → "✓ Ready" (green)
  - Any pending → "Processing…" (spinner or pulsing dot)
  - Any failed → "Failed — retry" (red)
- Add `⋯` three-dot menu per file: Delete (existing handler), Summarize (future), Ask about (future)
- Keep "Continue processing" / "Retry" as action in three-dot OR as inline button — decide in 10D
- Files: `FilePanel.tsx`

### 10E — Chat readability pass
**Goal:** Larger text, adjustable width
- Add CSS variables: `--tutor-chat-font-size` (default: 15px), `--tutor-chat-max-width` (default: 660px)
- Apply to `MessageBubble` styles
- Apply to `globals.css` `.message-content`
- Widen input bar min-height from 52px to 60px; match input font size to message font size
- Files: `TutorConversation.tsx`, `globals.css`

### 10F — Settings screen
**Goal:** Settings for display preferences; move ThemePicker and dev toggle
- New `src/app/settings/page.tsx` OR Settings modal component
- Entry point: gear icon (⚙) in sidebar footer
- Sections: Display (font size, chat width), Appearance (ThemePicker content), Advanced (dev diagnostics)
- CSS variable approach: Settings component reads/writes localStorage → applies to `:root`
- Files: new `settings/page.tsx` (or modal), `page.tsx` (remove ThemePicker, dev toggle from sidebar), `MainLayout.tsx` (gear icon)

### 10G — Sources display: hide by default
**Goal:** Remove noise from sources section
- Replace `SourcesSection` with "📄 N sources" badge or remove entirely
- Sources redesign (filename + page + quote) deferred until Document Understanding Layer Phase C/D
- Files: `TutorConversation.tsx`

### 10H — Visual style / theme polish
**Goal:** Cohesive visual refinement
- Typography tuning (font weights, spacing)
- Ensure default palette is the warm beige (already correct)
- Animate plus menu popover open/close
- Hover states, focus states, micro-interaction polish
- Files: `globals.css`, various component files

---

## 14. Validation results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ passed |
| `npx vitest run` | ✅ 75 files passed, 18 skipped; 947 tests passed, 121 skipped |
| `npm run build` | ✅ passed |
| `git diff --check` | ✅ passed |
| `graphify update .` | ✅ 4602 nodes, 6288 edges, 306 communities |

---

## 15. Risks / open decisions

| Risk / Decision | Status |
|----------------|--------|
| Session-file attachment model (`primaryFileId`, `attachedFileIds`) | Deferred — do NOT add during visual cleanup phase |
| Moving WorkMode/CostMode out of toolbar | Safe — state stays in `page.tsx`; only display location changes |
| ThemePicker migration to Settings | Decide: keep a quick-swap in sidebar OR full migration. Recommendation: move fully, add gear icon |
| Context strip fate after WorkMode removal | Strip becomes: "Topic: X · Sources: N". Could be simplified to just the conversation title in top bar. Decide in 10C. |
| Sources data enrichment dependency | Full sources redesign blocked on Document Understanding Layer Phase C (detectedQuestions with metadata) |
| Memory panel placement | Daily or not? Recommendation: move to Settings or separate debug screen, not daily sidebar |
| `max-w-[72%]` vs fixed `--tutor-chat-max-width` | Fixed is better for consistent readability; but needs viewport testing. Default 660px should be safe on 1280px+ screens. |
| Confirmation for three-dot menu actions | Current inline Hebrew confirm is functional. Keep for now; redesign if needed in 10H. |
| Plus menu implementation: popover vs modal | Popover (positioned above input) preferred for Apple-like feel. Accessibility (keyboard dismiss) required. |

---

## 16. Ready for Batch 10B?

**YES**

Batch 10B (sidebar IA + three-dot menu) is UI-only, touches only `WorkspaceSelector.tsx`. No backend changes. No data model changes. All existing rename/delete handlers remain unchanged — only the trigger UI changes from hover-reveal buttons to a three-dot menu.

---

## 17. Safety confirmations

- I did not change code.
- I did not redesign UI yet.
- I did not change tutor behavior.
- I did not change retrieval.
- I did not change Deep PDF behavior.
- I did not run `git add`.
- I did not commit.
- I did not push.
- I did not run `git pull`.

---

*Report created: 2026-06-03*
*Next batch: 10B — Sidebar information architecture and three-dot menu*
