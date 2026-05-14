# Design: Research-Based UX Corrections
**Date:** 2026-05-15
**Branch:** design/research-based-ux-corrections
**Status:** Approved

---

## Context

PR #27 merged the UX redesign. The sidebar structure (Topics/Conversations/Study materials/Tutor memory/ThemePicker), typography, and color tokens are already in place. Two pieces are missing:

1. The sidebar is not collapsible — it is fixed at 296px with no toggle.
2. There is no scope context visible in the chat area — the user has no visible reminder of which topic and mode they are working in.

This spec covers only those two gaps. All other components are left unchanged.

---

## Scope

**In scope:**
- Collapsible sidebar with mini-rail collapsed state
- Scope summary strip in TutorConversation
- Wiring `activeTopicName` through page.tsx

**Out of scope (explicitly):**
- Backend, API routes, Firebase, Auth, Firestore, Storage
- package.json / package-lock.json
- WorkspaceSelector labels (already correct)
- WorkModeSelector / CostModeSelector
- FilePanel, MemoryPanel, ThemePicker
- Any Gemini/Genkit/retrieval/memory/Storage feature
- Session transcript/message API

---

## Design

### 1. Collapsible Sidebar

**Approach A:** `MainLayout` owns collapse state locally.

**`MainLayout.tsx` changes:**

- Accept new optional prop: `activeTopicName?: string | null`
- Local state: `const [collapsed, setCollapsed] = useState(() => localStorage.getItem("tutor-sidebar-collapsed") === "true")`
- On toggle: flip state, write to `localStorage("tutor-sidebar-collapsed")`
- `<aside>` width: `collapsed ? "48px" : "var(--tutor-sidebar-width)"` with `transition: width 200ms ease`
- Sidebar body `{sidebar}` wrapped in a div with `visibility: collapsed ? "hidden" : "visible"` — preserves layout, hides content without reflow
- When expanded: collapse button `‹` in sidebar header (right side of "Private Tutor")
- When collapsed (mini-rail):
  - Full-height `›` expand button at top of rail
  - Topic initial pill (first letter of `activeTopicName`, uppercased) centered in rail — shown only if `activeTopicName` is non-null
  - Rail background: `var(--tutor-sidebar)`, border-right preserved

**CSS:** No new classes needed — inline styles with CSS custom properties.

**Collapse button placement:** The ‹ button sits in sidebar header, right of "Private Tutor" wordmark. It is part of the existing sidebar JSX (already built in `page.tsx`), not in MainLayout itself. MainLayout only provides the toggle handler and collapsed state.

Actually, cleaner: the toggle button lives **inside MainLayout** since it controls layout state. The sidebar header (Private Tutor + avatar) stays in page.tsx. A small `‹ / ›` button is placed by MainLayout at the top of the aside, overlapping or beside the sidebar content.

Revised: MainLayout renders a single toggle button always visible on the aside — a small chevron button pinned to the top of the aside, above the scrollable sidebar content. When expanded it shows `‹`, when collapsed it shows `›`. This button is entirely owned by MainLayout, independent of page.tsx's sidebar JSX.

**Mini-rail content (collapsed):**
```
┌──────┐
│  ‹   │  ← toggle button (top, centered)
│      │
│  C   │  ← topic initial pill (centered, mid-rail)
│      │
│      │
└──────┘
```

---

### 2. Scope Summary Strip

**`TutorConversation.tsx` changes:**

- Accept new prop: `activeTopicName?: string | null`
- Render a thin strip between toolbar and message list:

```
Topic: Calculus 1 · Mode: Learn · Sources: not connected yet
```

**Spec:**
- Font: 11px, `var(--tutor-text-muted)`
- Background: `var(--tutor-surface)`
- Border-bottom: `1px solid var(--tutor-border-subtle)`
- Padding: `px-6 py-1.5`
- `dir="ltr"`, `lang` unset
- Content: `Topic: {topicName} · Mode: {modeLabel} · Sources: not connected yet`
- `topicName`: `activeTopicName ?? "No topic"`
- `modeLabel`: inline map `{ Learning: "Learn", Practice: "Practice", Research: "Research", Build: "Build", "Temporary Chat": "Temp Chat" }` — duplicates the one in WorkModeSelector (intentional, no shared import to avoid coupling)
- Sources wording: `"not connected yet"` — honest, implies future without asserting false retrieval

---

### 3. page.tsx Wiring

Derive `activeTopicName` once and pass to both `MainLayout` and `TutorConversation`:

```ts
const activeTopicName =
  workspaceState.status === "ready" && activeWorkspaceId
    ? (workspaceState.workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? null)
    : null;
```

Pass to `MainLayout`:
```tsx
<MainLayout sidebar={sidebar} activeTopicName={activeTopicName}>
```

Pass to `TutorConversation`:
```tsx
<TutorConversation
  ...
  activeTopicName={activeTopicName}
/>
```

---

## Files Changed

| File | Change |
|---|---|
| `src/components/layout/MainLayout.tsx` | Collapse state, mini-rail, toggle button, `activeTopicName` prop |
| `src/components/tutor/TutorConversation.tsx` | `activeTopicName` prop, scope strip |
| `src/app/page.tsx` | Derive `activeTopicName`, pass to MainLayout + TutorConversation |

---

## Not Changed

- `src/components/workspaces/WorkspaceSelector.tsx` — Topics/Conversations labels already correct
- `src/components/layout/CollapsiblePanel.tsx` — already works
- `src/components/workModes/WorkModeSelector.tsx` — Learn/Practice/More already correct
- `src/components/costModes/CostModeSelector.tsx`
- `src/components/files/FilePanel.tsx`
- `src/components/memory/MemoryPanel.tsx`
- `src/components/settings/ThemePicker.tsx`
- `src/app/globals.css`
- All backend, API routes, Firebase, Auth, Firestore, Storage
- `package.json`, `package-lock.json`

---

## Behavior Preserved

- Auth flow unchanged
- Workspace/session data flow unchanged
- All existing tests continue to pass
- ThemePicker customization unaffected
- Study materials / Tutor memory panels unaffected
- Mock data unaffected

---

## Testing Plan

```bash
npm run build
npm run lint
npx vitest run
```

Manual smoke:
1. Sign in
2. Confirm sidebar visible, "Private Tutor" + topics
3. Click collapse — sidebar narrows to 48px rail, topic initial appears
4. Click expand — sidebar restores
5. Reload — collapsed state persists (localStorage)
6. Select a topic — scope strip shows `Topic: {name} · Mode: Learn · Sources: not connected yet`
7. Change mode — scope strip updates
8. Confirm chat remains dominant visual area
9. Confirm ThemePicker still opens and persists color changes
