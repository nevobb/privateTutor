# UX Redesign Pass Report

## 1. Branch

`design/personal-tutor-ux-redesign`

## 2. Nevo design preferences applied

- Modern, calm, warm, personal study environment — not LMS, not admin dashboard
- Left sidebar as primary navigation/context area
- Chat occupies almost the whole screen; panels collapsible and visually secondary
- Workspaces feel like folders/topics; sessions feel like conversations inside the topic
- Clean chat-first layout similar in spirit to ChatGPT/Gemini
- Hebrew messages fully support RTL via `dir="auto"` on message content
- UI layout uses left navigation (not forced RTL globally)
- Primary visible modes: Learn + Practice; Research behind "More" dropdown
- Deep Research, Temporary Chat, Cheap Practice not visible as primary modes
- Centralized CSS design tokens for future theme customization
- Warm off-white palette, sage green accent, subtle borders/shadows

## 3. Files changed

| File | Change |
|------|--------|
| `src/app/globals.css` | Theme tokens (CSS variables), Lora font import, scrollbar style |
| `src/components/layout/MainLayout.tsx` | Redesigned: 2-column (sidebar + main), removed 3-column layout |
| `src/components/workspaces/WorkspaceSelector.tsx` | Redesigned: sidebar-native folder/conversation list |
| `src/components/workModes/WorkModeSelector.tsx` | Simplified: Learn/Practice primary pills; Research/Build/Temp behind "עוד" dropdown |
| `src/components/costModes/CostModeSelector.tsx` | Simplified: compact badge with dropdown; Cheap Practice/Deep Research accessible but not primary |
| `src/components/tutor/TutorConversation.tsx` | Redesigned: chat-first, no raw session ID, `dir="auto"` on messages, auto-growing textarea, typing dots |
| `src/components/files/FilePanel.tsx` | Quieter: minimal list, no heavy card borders |
| `src/components/memory/MemoryPanel.tsx` | Quieter: compact mastery bar + observation list |
| `src/components/auth/AuthShell.tsx` | Polished: Lora wordmark, warm colors, calm wording |
| `src/app/page.tsx` | Restructured: sidebar composed inline, CollapsiblePanel for Files/Memory, new MainLayout API |

## 4. Files added

| File | Purpose |
|------|---------|
| `src/components/layout/CollapsiblePanel.tsx` | Small helper: collapsible sidebar section with toggle arrow and item count badge |

## 5. Layout changes

**Before:** 3-column layout (320px right sidebar + flex center + 320px left sidebar) with crowded top header containing WorkspaceSelector as raw `<select>` dropdowns.

**After:**
- `dir="ltr"` on layout container so sidebar is predictably on the physical left regardless of global RTL
- Left sidebar 296px (`--tutor-sidebar-width`): app branding header + workspace/session navigation + collapsible panels
- Main area `flex-1`: clean chat fills all remaining space
- No crowded top header competing with the chat

## 6. Workspace/session sidebar changes

- Workspaces displayed as clickable folder-style list items (📁 / 📂 selected)
- Selected workspace highlighted with `--tutor-sidebar-active` background
- Sessions displayed as conversation list (💬) below selected workspace section
- Active session highlighted with `--tutor-accent-light` background
- Create workspace: inline form, not a popup
- Create session: subtle "+ שיחה חדשה" link
- Raw UUIDs never displayed as primary visible text
- All loading/error/empty states preserved

## 7. Tutor conversation changes

- Chat-first layout: messages fill the screen
- User messages: right-aligned with soft blue bubble (`--tutor-user-bubble`)
- Tutor messages: left-aligned with white surface + Lora serif font
- `dir="auto"` on all message content — Hebrew goes RTL automatically, English stays LTR
- Raw session ID removed from primary UI; subtle notice shows only when no session active
- Auto-growing textarea replaces single-line input
- Typing indicator: 3 bouncing dots instead of text label
- Send button changes color when input is non-empty

## 8. Mode simplification changes

**WorkMode:**
- Primary: `למידה` (Learning) + `תרגול` (Practice) as pill buttons
- Advanced: `עוד ▾` dropdown reveals Research, Build, Temporary Chat
- All `WorkMode` enum values remain unchanged — only presentation changed

**CostMode:**
- Shows current mode as compact `⚙ רגיל ▾` badge
- Dropdown reveals all 3 modes (Normal Learning default, Cheap Practice + Deep Research accessible)
- All `CostMode` enum values remain unchanged — only presentation changed

## 9. Theme/color preparation

CSS variables defined in `:root` in `globals.css`:

```css
--tutor-bg: #F8F4EF          /* warm off-white background */
--tutor-sidebar: #EDE7DC     /* warm beige sidebar */
--tutor-surface: #FFFFFF     /* white surfaces */
--tutor-border: #D8CFBF      /* warm gray border */
--tutor-text: #2A1F14        /* warm dark brown */
--tutor-accent: #4D7E62      /* sage green */
--tutor-accent-light: #EAF2EC
--tutor-user-bubble: #E8EDFF /* user message blue */
```

**Future theme customization direction:**
- All components use `var(--tutor-*)` tokens via inline styles
- A future theme picker only needs to update `:root` variable values
- Could expose a small JSON config object that writes to CSS variables at runtime
- No large theme system built — just the token layer

## 10. File/memory panel changes

- Both panels moved out of competing sidebars and into collapsible sections at the bottom of the left sidebar
- `CollapsiblePanel` wraps each with a toggle arrow and optional item count badge
- Default state: collapsed (panels don't compete with workspace navigation)
- FilePanel: minimal icon + name + date list (no heavy card borders)
- MemoryPanel: compact mastery bar + observation list (max 4 shown)

## 11. Auth shell changes

- Signed-out screen: Lora serif wordmark "מורה פרטי", calm wording, warm background using CSS variables
- Sign-in button uses `--tutor-accent` green
- No auth behavior changes

## 12. Behavior preserved

- All workspace loading/error/empty states preserved
- All session loading/error/empty states preserved
- `activeWorkspaceId` and `activeSessionId` state behavior unchanged
- Workspace create/select flow unchanged
- Session create/select flow unchanged
- Work mode and cost mode state flow unchanged
- All `WorkMode` and `CostMode` enum values preserved
- All API clients, server code, Firebase code untouched
- All behavior tests pass (146/146)

## 13. What was explicitly not changed

- `src/app/api/*` — API routes unchanged
- `src/server/*` — server code unchanged
- `src/lib/*` — all lib code unchanged
- `tests/server/*`, `tests/firebase/*` — test code unchanged
- `firestore.rules`, `storage.rules` — rules unchanged
- `package.json`, `package-lock.json` — packages unchanged
- `src/app/layout.tsx` — root layout unchanged
- No Gemini, Genkit, retrieval, memory persistence, Storage added
- No new npm packages added
- WorkMode/CostMode enum values not removed

## 14. Commands run

| Command | Result |
|---------|--------|
| `npm run build` | ✓ Compiled successfully |
| `npm run lint` | ✓ 0 errors (9 pre-existing warnings in test files) |
| `npx vitest run` | ✓ 146 passed, 0 failed |
| `git diff --check` | ✓ No whitespace errors |

## 15. Manual smoke result

Not run in this session — requires running Firebase emulators. See smoke check list in the brief.

## 16. Exact next task

**Manual browser UX smoke test** (next step before any PR merge):

1. `firebase emulators:start --only auth,firestore,storage --project demo-private-tutor`
2. `npm run dev`
3. Verify:
   - Sign-in screen looks warm/calm with Lora wordmark
   - After sign-in: left sidebar shows "מורה פרטי" header with avatar
   - Workspaces load as folder list in sidebar
   - Create workspace → appears as folder item
   - Select workspace → sessions section appears below
   - Create session → appears in session list, no raw UUID visible
   - Send tutor message → chat-first layout, Hebrew RTL works
   - Switch Learn/Practice → pill buttons update
   - Click "עוד" → Research/Build/Temp dropdown appears
   - Click cost mode badge → dropdown shows all 3 options
   - Collapse/expand Files and Memory panels in sidebar

**After smoke test:** Session transcript/message API boundary (Step 38).
