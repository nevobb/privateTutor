# Research-Based UX Corrections Report

**Branch:** design/research-based-ux-corrections-clean
**Date:** 2026-05-15
**Type:** Design/UX only — no backend, API, or Firebase changes

---

## 1. Branch Used

`design/research-based-ux-corrections-clean` (branched from `main` after PR #27 merge)

---

## 2. Research UX Findings Applied

1. **Sidebar should be collapsible** — calm personal workspace, not a fixed control panel.
2. **Chat must remain dominant** — sidebar collapses to minimal 48px rail, never zero.
3. **Scope context must be visible near chat** — replaces the need for mental context-tracking while many independent mode controls exist.
4. **Sources wording must be honest** — "not connected yet" rather than implying real retrieval.
5. **Topic/Conversation hierarchy already correct** — WorkspaceSelector already uses "Topics" / "Conversations" from PR #27.
6. **Study materials / Tutor memory labels already correct** — CollapsiblePanel sections in sidebar already labelled correctly.

---

## 3. Files Changed

| File | Change |
|---|---|
| `src/components/layout/MainLayout.tsx` | Full rewrite: lazy collapsed state (localStorage), mini-rail (48px) when collapsed, edge-tab `‹` trigger when expanded, `activeTopicName` prop |
| `src/components/tutor/TutorConversation.tsx` | `activeTopicName` prop + scope summary strip + `SCOPE_MODE_LABELS` at module scope |
| `src/app/page.tsx` | Derived `activeTopicName` from workspace state, passed to MainLayout + TutorConversation |

---

## 4. Sidebar Collapse Behavior

- **Default state:** expanded (296px)
- **Persistence:** `localStorage("tutor-sidebar-collapsed")` — survives page reload
- **Initialization:** lazy `useState` initializer (no useEffect, no flash, lint-clean)
- **Collapsed state:** 48px mini-rail
  - `›` expand button at top (aria-label="Expand sidebar")
  - Topic initial pill (e.g. `C` for Calculus 1) if a topic is selected
  - Inner content hidden via `overflow: hidden`
- **Expanded state:** edge-tab `‹` on right border (position:absolute, 13px wide, opacity 40% → 100% hover)
- **Transition:** `width 200ms ease` on `<aside>`

---

## 5. Topic/Conversation Hierarchy

No changes needed — `WorkspaceSelector` already uses "Topics" / "Conversations" labels from PR #27. Hierarchy remains:

```
Topics
  Calculus 1          ← active, left accent border
  Electromagnetism
  + New topic

Conversations
  Limits intuition    ← active
  Homework 3 questions
  + New conversation
```

---

## 6. Scope Summary Strip

Thin strip between toolbar and message list in `TutorConversation`:

```
Topic: Calculus 1 · Mode: Learn · Sources: not connected yet
```

- Font: 11px, `var(--tutor-text-muted)`, `var(--tutor-surface)` bg
- `flex-shrink-0`, `dir="ltr"`, bottom border `var(--tutor-border-subtle)`
- Updates reactively as topic or mode changes
- Sources text: "not connected yet" — honest, no fake retrieval implied
- `SCOPE_MODE_LABELS` at module scope (not re-created on every render)

---

## 7. Study Materials / Memory Treatment

Unchanged. Already correctly labeled in sidebar:
- "Study materials" (CollapsiblePanel with FilePanel)
- "Tutor memory" (CollapsiblePanel with MemoryPanel)

---

## 8. Appearance Treatment

Unchanged. `ThemePicker` remains in sidebar footer as a secondary button/modal. Does not compete with Topics/Conversations.

---

## 9. Behavior Preserved

- Auth flow: unchanged
- Workspace/session data flow: unchanged
- All existing behavior tests T001–T013: pass
- WorkspaceSelector Topics/Conversations: unchanged
- WorkModeSelector Learn/Practice/More: unchanged
- CollapsiblePanel Study materials/Tutor memory: unchanged

---

## 10. What Was Explicitly NOT Changed

- Backend, API routes, Firebase, Auth, Firestore, Storage
- `package.json`, `package-lock.json`
- `WorkspaceSelector.tsx`, `CollapsiblePanel.tsx`
- `WorkModeSelector.tsx`, `CostModeSelector.tsx`
- `FilePanel.tsx`, `MemoryPanel.tsx`, `ThemePicker.tsx`
- `globals.css`
- No Gemini, Genkit, retrieval, memory persistence, Storage upload added

---

## 11. Commands Run

```
npm run build   ✓  (all routes compiled cleanly)
npm run lint    ✓  (0 errors, 10 pre-existing warnings in test files)
npx vitest run  ✓  (153 passed, 0 failed, 92 skipped)
```

---

## 12. Manual Smoke Test

Not run (requires Firebase Auth emulator). See procedure below.

**Smoke test procedure:**
```bash
firebase emulators:start --only auth,firestore --project demo-private-tutor
npm run dev
```

Checklist:
- [ ] Sign in — sidebar visible, "Private Tutor" heading
- [ ] Edge-tab `‹` visible on sidebar right border (hover to reveal fully)
- [ ] Click edge-tab → sidebar collapses to 48px mini-rail
- [ ] Select a topic → topic initial appears in mini-rail (e.g. `C`)
- [ ] Click `›` → sidebar expands back
- [ ] Reload → collapsed state persists
- [ ] Scope strip shows: `Topic: {name} · Mode: Learn · Sources: not connected yet`
- [ ] Change mode → scope strip updates
- [ ] Chat area dominates — sidebar is secondary
- [ ] ThemePicker still opens and persists color changes

---

## 13. Next Task

**Step 39 — Session transcript/message API boundary**

Connect TutorConversation to real session messages via existing session API routes.
Branch: create from `main`.
